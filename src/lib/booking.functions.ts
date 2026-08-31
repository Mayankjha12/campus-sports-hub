import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getCollections, isDuplicateKeyError } from "./mongo";
import { requireAuth } from "./auth.server";

const slotSchema = z.object({
  facilityId: z.string(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function endOf(start: string): string {
  const hour = Number(start.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00:00`;
}

function reference(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(10000 + Math.random() * 89999);
  return `SH-${year}-${n}`;
}

export type BookingResult =
  | { ok: true; bookingId: string; reference: string; idempotent: boolean }
  | { ok: false; code: "conflict" | "closed" | "past" | "error"; message: string };

/**
 * Concurrency-safe booking.
 *
 * The database is the single source of truth: a partial unique index on
 * (facility_id, booking_date, start_time) where status = 'confirmed' means that
 * out of N simultaneous inserts, exactly one commits and the rest fail with
 * duplicate-key error 11000, which we translate into a friendly conflict
 * response. (In the Supabase original this was Postgres unique-violation 23505.)
 */
export const bookSlot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => slotSchema.parse(data))
  .handler(async ({ data, context }): Promise<BookingResult> => {
    const { userId } = context;
    const { facilities, bookings, notifications } = await getCollections();
    const startTime = normalizeTime(data.startTime);
    const endTime = endOf(startTime);

    const facility = await facilities.findOne({ _id: data.facilityId });
    if (!facility) {
      return { ok: false, code: "error", message: "Facility could not be found." };
    }
    if (facility.status !== "open") {
      return {
        ok: false,
        code: "closed",
        message:
          facility.status === "maintenance"
            ? "This facility is under maintenance and cannot be booked right now."
            : "This facility is currently closed for bookings.",
      };
    }

    const hour = Number(startTime.slice(0, 2));
    if (hour < facility.open_hour || hour >= facility.close_hour) {
      return { ok: false, code: "closed", message: "That time is outside the facility's operating hours." };
    }
    if (new Date(`${data.bookingDate}T${startTime}`).getTime() <= Date.now()) {
      return { ok: false, code: "past", message: "That slot has already started. Pick a later slot." };
    }

    // Idempotency: the same user re-submitting the same slot returns the existing booking.
    const existing = await bookings.findOne({
      facility_id: data.facilityId,
      booking_date: data.bookingDate,
      start_time: startTime,
      status: "confirmed",
    });

    if (existing) {
      if (existing.user_id === userId) {
        return { ok: true, bookingId: existing._id, reference: existing.reference, idempotent: true };
      }
      return {
        ok: false,
        code: "conflict",
        message: "This slot was just booked by another student. Please select another slot.",
      };
    }

    const ref = reference();
    const doc = {
      _id: crypto.randomUUID(),
      reference: ref,
      user_id: userId,
      facility_id: data.facilityId,
      booking_date: data.bookingDate,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed" as const,
      created_at: new Date(),
    };

    try {
      await bookings.insertOne(doc);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return {
          ok: false,
          code: "conflict",
          message: "This slot was just booked by another student. Please select another slot.",
        };
      }
      return { ok: false, code: "error", message: "Unable to complete the booking. Please try again." };
    }

    await notifications.insertOne({
      _id: crypto.randomUUID(),
      user_id: userId,
      title: "Booking confirmed",
      body: `${facility.name} on ${data.bookingDate} at ${startTime.slice(0, 5)} is confirmed. Reference ${ref}.`,
      kind: "booking_confirmed",
      read: false,
      created_at: new Date(),
    });

    return { ok: true, bookingId: doc._id, reference: ref, idempotent: false };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { facilities, bookings, waitlist, notifications } = await getCollections();

    // Atomically flip only this user's confirmed booking to cancelled.
    const booking = await bookings.findOneAndUpdate(
      { _id: data.bookingId, user_id: userId, status: "confirmed" },
      { $set: { status: "cancelled" } },
      { returnDocument: "after" },
    );

    if (!booking) {
      return { ok: false as const, message: "This booking could not be cancelled." };
    }

    const facility = await facilities.findOne({ _id: booking.facility_id });

    await notifications.insertOne({
      _id: crypto.randomUUID(),
      user_id: userId,
      title: "Booking cancelled",
      body: `${facility?.name ?? "Your facility"} booking ${booking.reference} was cancelled and the slot has been released.`,
      kind: "booking_cancelled",
      read: false,
      created_at: new Date(),
    });

    // Notify everyone waiting on the freed slot.
    const waiting = await waitlist
      .find({
        facility_id: booking.facility_id,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        status: "waiting",
      })
      .toArray();

    if (waiting.length) {
      await waitlist.updateMany(
        { _id: { $in: waiting.map((w) => w._id) } },
        { $set: { status: "available" } },
      );
      await notifications.insertMany(
        waiting.map((w) => ({
          _id: crypto.randomUUID(),
          user_id: w.user_id,
          title: "Your requested slot is now available!",
          body: `${facility?.name ?? "A facility"} on ${booking.booking_date} at ${booking.start_time.slice(0, 5)} just opened up. Book it before someone else does.`,
          kind: "waitlist_available",
          read: false,
          created_at: new Date(),
        })),
      );
    }

    return { ok: true as const, message: "Booking cancelled. The slot is available again." };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => slotSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { waitlist, notifications } = await getCollections();
    const startTime = normalizeTime(data.startTime);

    try {
      await waitlist.updateOne(
        { user_id: userId, facility_id: data.facilityId, booking_date: data.bookingDate, start_time: startTime },
        {
          $set: { end_time: endOf(startTime), status: "waiting" },
          $setOnInsert: { _id: crypto.randomUUID(), created_at: new Date() },
        },
        { upsert: true },
      );
    } catch {
      return { ok: false as const, position: 0, message: "Could not join the waitlist. Please try again." };
    }

    const queue = await waitlist
      .find({ facility_id: data.facilityId, booking_date: data.bookingDate, start_time: startTime })
      .sort({ created_at: 1 })
      .toArray();

    const position = Math.max(1, queue.findIndex((row) => row.user_id === userId) + 1);

    await notifications.insertOne({
      _id: crypto.randomUUID(),
      user_id: userId,
      title: "Added to waitlist",
      body: `You are #${position} on the waitlist for ${data.bookingDate} at ${startTime.slice(0, 5)}.`,
      kind: "waitlist_joined",
      read: false,
      created_at: new Date(),
    });

    return { ok: true as const, position, message: `You are #${position} on the waitlist.` };
  });

/**
 * Concurrency demo: hits the same database guarantee against a scratch table so
 * the presentation can be replayed without polluting real bookings.
 */
export const demoBookAttempt = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        runId: z.string().min(4).max(64),
        facilityId: z.string(),
        bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        actor: z.string().min(1).max(32),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { demo_bookings } = await getCollections();
    try {
      await demo_bookings.insertOne({
        _id: crypto.randomUUID(),
        run_id: data.runId,
        facility_id: data.facilityId,
        booking_date: data.bookingDate,
        start_time: normalizeTime(data.startTime),
        actor: data.actor,
        created_at: new Date(),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        return {
          actor: data.actor,
          status: "conflict" as const,
          detail: "SLOT ALREADY BOOKED (unique violation 11000)",
        };
      }
      return { actor: data.actor, status: "error" as const, detail: "Request failed" };
    }
    return { actor: data.actor, status: "booked" as const, detail: "BOOKING CONFIRMED" };
  });

export const demoRunSummary = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => z.object({ runId: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const { demo_bookings } = await getCollections();
    const rows = await demo_bookings
      .find({ run_id: data.runId })
      .project({ actor: 1, created_at: 1, _id: 0 })
      .toArray();
    return { rows, count: rows.length };
  });
