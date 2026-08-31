import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getCollections, type FacilityStatus } from "./mongo";
import { requireAuth } from "./auth.server";

/**
 * Read + light-mutation server functions backing the React Query hooks.
 * MongoDB is server-only, so every browser read that used to hit
 * `supabase.from(...)` now goes through one of these.
 */

export interface FacilityDTO {
  id: string;
  name: string;
  sport: string;
  location: string;
  capacity: number;
  equipment: string[];
  description: string;
  image_key: string;
  open_hour: number;
  close_hour: number;
  status: FacilityStatus;
}

export interface BookingDTO {
  id: string;
  reference: string;
  user_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled" | "completed";
  created_at: string;
}

export interface WaitlistDTO {
  id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

export interface NotificationDTO {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
}

const dateRange = z.object({ from: z.string(), to: z.string() });

export const listFacilitiesFn = createServerFn({ method: "GET" }).handler(async (): Promise<FacilityDTO[]> => {
  const { facilities } = await getCollections();
  const rows = await facilities.find().sort({ name: 1 }).toArray();
  return rows.map((f) => ({
    id: f._id,
    name: f.name,
    sport: f.sport,
    location: f.location,
    capacity: f.capacity,
    equipment: f.equipment,
    description: f.description,
    image_key: f.image_key,
    open_hour: f.open_hour,
    close_hour: f.close_hour,
    status: f.status,
  }));
});

export const getFacilityFn = createServerFn({ method: "GET" })
  .inputValidator((id: unknown) => z.string().parse(id))
  .handler(async ({ data: id }): Promise<FacilityDTO | null> => {
    const { facilities } = await getCollections();
    const f = await facilities.findOne({ _id: id });
    if (!f) return null;
    return {
      id: f._id,
      name: f.name,
      sport: f.sport,
      location: f.location,
      capacity: f.capacity,
      equipment: f.equipment,
      description: f.description,
      image_key: f.image_key,
      open_hour: f.open_hour,
      close_hour: f.close_hour,
      status: f.status,
    };
  });

/** Confirmed bookings for a facility on a given day (public — powers slot availability). */
export const listDayBookingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ facilityId: z.string(), date: z.string() }).parse(data))
  .handler(async ({ data }): Promise<BookingDTO[]> => {
    const { bookings } = await getCollections();
    const rows = await bookings
      .find({ facility_id: data.facilityId, booking_date: data.date, status: "confirmed" })
      .toArray();
    return rows.map(toBookingDTO);
  });

export const listConfirmedForDateFn = createServerFn({ method: "GET" })
  .inputValidator((date: unknown) => z.string().parse(date))
  .handler(async ({ data: date }): Promise<BookingDTO[]> => {
    const { bookings } = await getCollections();
    const rows = await bookings.find({ booking_date: date, status: "confirmed" }).toArray();
    return rows.map(toBookingDTO);
  });

export const listMyBookingsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<BookingDTO[]> => {
    const { bookings } = await getCollections();
    const rows = await bookings
      .find({ user_id: context.userId })
      .sort({ booking_date: -1, start_time: -1 })
      .toArray();
    return rows.map(toBookingDTO);
  });

export const listMyWaitlistFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<WaitlistDTO[]> => {
    const { waitlist } = await getCollections();
    const rows = await waitlist.find({ user_id: context.userId }).sort({ created_at: -1 }).toArray();
    return rows.map((w) => ({
      id: w._id,
      facility_id: w.facility_id,
      booking_date: w.booking_date,
      start_time: w.start_time,
      end_time: w.end_time,
      status: w.status,
      created_at: w.created_at.toISOString(),
    }));
  });

export const listNotificationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<NotificationDTO[]> => {
    const { notifications } = await getCollections();
    const rows = await notifications.find({ user_id: context.userId }).sort({ created_at: -1 }).limit(50).toArray();
    return rows.map((n) => ({
      id: n._id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      read: n.read,
      created_at: n.created_at.toISOString(),
    }));
  });

export const listAllBookingsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => dateRange.parse(data))
  .handler(async ({ data, context }): Promise<BookingDTO[]> => {
    if (!context.isAdmin) throw new Error("Forbidden: admin only.");
    const { bookings } = await getCollections();
    const rows = await bookings
      .find({ booking_date: { $gte: data.from, $lte: data.to } })
      .sort({ booking_date: 1, start_time: 1 })
      .toArray();
    return rows.map(toBookingDTO);
  });

export const markNotificationsReadFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { notifications } = await getCollections();
    await notifications.updateMany({ user_id: context.userId, read: false }, { $set: { read: true } });
    return { ok: true as const };
  });

export const setFacilityStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ facilityId: z.string(), status: z.enum(["open", "closed", "maintenance"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden: admin only.");
    const { facilities } = await getCollections();
    await facilities.updateOne({ _id: data.facilityId }, { $set: { status: data.status } });
    return { ok: true as const };
  });

function toBookingDTO(b: {
  _id: string;
  reference: string;
  user_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled" | "completed";
  created_at: Date;
}): BookingDTO {
  return {
    id: b._id,
    reference: b.reference,
    user_id: b.user_id,
    facility_id: b.facility_id,
    booking_date: b.booking_date,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
    created_at: b.created_at.toISOString(),
  };
}
