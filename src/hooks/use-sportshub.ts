import { useQuery } from "@tanstack/react-query";

import type { Booking, Facility } from "@/lib/sportshub";
import {
  listFacilitiesFn,
  getFacilityFn,
  listDayBookingsFn,
  listMyBookingsFn,
  listMyWaitlistFn,
  listNotificationsFn,
  listAllBookingsFn,
  listConfirmedForDateFn,
} from "@/lib/data.server";

export function useFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: async (): Promise<Facility[]> => (await listFacilitiesFn()) as Facility[],
  });
}

export function useFacility(id: string) {
  return useQuery({
    queryKey: ["facility", id],
    queryFn: async (): Promise<Facility | null> => ((await getFacilityFn({ data: id })) as Facility) ?? null,
    enabled: Boolean(id),
  });
}

/** All confirmed bookings for a facility on a date — used to compute slot availability. */
export function useFacilityDayBookings(facilityId: string, date: string) {
  return useQuery({
    queryKey: ["facility-bookings", facilityId, date],
    queryFn: async (): Promise<Booking[]> =>
      (await listDayBookingsFn({ data: { facilityId, date } })) as Booking[],
    enabled: Boolean(facilityId && date),
    refetchInterval: 20000,
  });
}

/** Confirmed bookings across all facilities for a date (availability counters). */
export function useDayBookings(date: string) {
  return useQuery({
    queryKey: ["day-bookings", date],
    queryFn: async (): Promise<Booking[]> => {
      return (await listConfirmedForDateFn({ data: date })) as Booking[];
    },
    enabled: Boolean(date),
  });
}

export function useMyBookings(userId?: string) {
  return useQuery({
    queryKey: ["my-bookings", userId],
    queryFn: async (): Promise<Booking[]> => (await listMyBookingsFn()) as Booking[],
    enabled: Boolean(userId),
  });
}

export interface WaitlistEntry {
  id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

export function useMyWaitlist(userId?: string) {
  return useQuery({
    queryKey: ["my-waitlist", userId],
    queryFn: async (): Promise<WaitlistEntry[]> => (await listMyWaitlistFn()) as WaitlistEntry[],
    enabled: Boolean(userId),
  });
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  created_at: string;
}

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: ["notifications", userId],
    queryFn: async (): Promise<NotificationRow[]> => (await listNotificationsFn()) as NotificationRow[],
    enabled: Boolean(userId),
    refetchInterval: 30000,
  });
}

/** Admin: all confirmed/cancelled bookings in a date window. */
export function useAllBookings(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["all-bookings", fromDate, toDate],
    queryFn: async (): Promise<Booking[]> =>
      (await listAllBookingsFn({ data: { from: fromDate, to: toDate } })) as Booking[],
  });
}
