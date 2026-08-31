import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slotSchema = z.object({
  facilityId: z.string().uuid(),
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
 * (facility_id, booking_date, start_time) WHERE status = 'confirmed' means that
 * out of N simultaneous inserts, exactly one commits and the rest fail with
 * unique-violation 23505, which we translate into a friendly conflict response.
 */
export const bookSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => slotSchema.parse(data))
  .handler(async ({ data, context }): Promise<BookingResult> => {
    const { supabase, userId } = context;
    const startTime = normalizeTime(data.startTime);
    const endTime = endOf(startTime);

    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("id, name, status, open_hour, close_hour")
      .eq("id", data.facilityId)
      .maybeSingle();

    if (facilityError || !facility) {
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
    const { data: existing } = await supabase
      .from("bookings")
      .select("id, reference")
      .eq("facility_id", data.facilityId)
      .eq("booking_date", data.bookingDate)
      .eq("start_time", startTime)
      .eq("status", "confirmed")
      .maybeSingle();

    if (existing) {
      const { data: mine } = await supabase
        .from("bookings")
        .select("id, reference")
        .eq("id", existing.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (mine) {
        return { ok: true, bookingId: mine.id, reference: mine.reference, idempotent: true };
      }
      return {
        ok: false,
        code: "conflict",
        message: "This slot was just booked by another student. Please select another slot.",
      };
    }

    const ref = reference();
    const { data: inserted, error } = await supabase
      .from("bookings")
      .insert({
        reference: ref,
        user_id: userId,
        facility_id: data.facilityId,
        booking_date: data.bookingDate,
        start_time: startTime,
        end_time: endTime,
        status: "confirmed",
      })
      .select("id, reference")
      .single();

    if (error) {
      // 23505 = unique violation on bookings_unique_active_slot
      if (error.code === "23505") {
        return {
          ok: false,
          code: "conflict",
          message: "This slot was just booked by another student. Please select another slot.",
        };
      }
      return { ok: false, code: "error", message: "Unable to complete the booking. Please try again." };
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Booking confirmed",
      body: `${facility.name} on ${data.bookingDate} at ${startTime.slice(0, 5)} is confirmed. Reference ${ref}.`,
      kind: "booking_confirmed",
    });

    return { ok: true, bookingId: inserted.id, reference: inserted.reference, idempotent: false };
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId)
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .select("id, facility_id, booking_date, start_time, reference")
      .maybeSingle();

    if (error || !booking) {
      return { ok: false as const, message: "This booking could not be cancelled." };
    }

    const { data: facility } = await supabase
      .from("facilities")
      .select("name")
      .eq("id", booking.facility_id)
      .maybeSingle();

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Booking cancelled",
      body: `${facility?.name ?? "Your facility"} booking ${booking.reference} was cancelled and the slot has been released.`,
      kind: "booking_cancelled",
    });

    // Notify everyone waiting on the freed slot.
    const { data: waiting } = await supabase
      .from("waitlist")
      .select("id, user_id")
      .eq("facility_id", booking.facility_id)
      .eq("booking_date", booking.booking_date)
      .eq("start_time", booking.start_time)
      .eq("status", "waiting");

    if (waiting?.length) {
      await supabase
        .from("waitlist")
        .update({ status: "available" })
        .in(
          "id",
          waiting.map((w) => w.id),
        );
      await supabase.from("notifications").insert(
        waiting.map((w) => ({
          user_id: w.user_id,
          title: "Your requested slot is now available!",
          body: `${facility?.name ?? "A facility"} on ${booking.booking_date} at ${booking.start_time.slice(0, 5)} just opened up. Book it before someone else does.`,
          kind: "waitlist_available",
        })),
      );
    }

    return { ok: true as const, message: "Booking cancelled. The slot is available again." };
  });

export const joinWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => slotSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const startTime = normalizeTime(data.startTime);

    const { error } = await supabase.from("waitlist").upsert(
      {
        user_id: userId,
        facility_id: data.facilityId,
        booking_date: data.bookingDate,
        start_time: startTime,
        end_time: endOf(startTime),
        status: "waiting",
      },
      { onConflict: "user_id,facility_id,booking_date,start_time" },
    );

    if (error) {
      return { ok: false as const, position: 0, message: "Could not join the waitlist. Please try again." };
    }

    const { data: queue } = await supabase
      .from("waitlist")
      .select("user_id, created_at")
      .eq("facility_id", data.facilityId)
      .eq("booking_date", data.bookingDate)
      .eq("start_time", startTime)
      .order("created_at", { ascending: true });

    const position = Math.max(1, (queue ?? []).findIndex((row) => row.user_id === userId) + 1);

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Added to waitlist",
      body: `You are #${position} on the waitlist for ${data.bookingDate} at ${startTime.slice(0, 5)}.`,
      kind: "waitlist_joined",
    });

    return { ok: true as const, position, message: `You are #${position} on the waitlist.` };
  });

/**
 * Concurrency demo: hits the same database guarantee against a scratch table so
 * the presentation can be replayed without polluting real bookings.
 */
export const demoBookAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        runId: z.string().min(4).max(64),
        facilityId: z.string().uuid(),
        bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        actor: z.string().min(1).max(32),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("demo_bookings").insert({
      run_id: data.runId,
      facility_id: data.facilityId,
      booking_date: data.bookingDate,
      start_time: normalizeTime(data.startTime),
      actor: data.actor,
    });

    if (error) {
      return {
        actor: data.actor,
        status: error.code === "23505" ? ("conflict" as const) : ("error" as const),
        detail: error.code === "23505" ? "SLOT ALREADY BOOKED (unique violation 23505)" : "Request failed",
      };
    }
    return { actor: data.actor, status: "booked" as const, detail: "BOOKING CONFIRMED" };
  });

export const demoRunSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ runId: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("demo_bookings")
      .select("actor, created_at")
      .eq("run_id", data.runId);
    return { rows: rows ?? [], count: rows?.length ?? 0 };
  });
