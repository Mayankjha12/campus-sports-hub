import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Booking, Facility } from "@/lib/sportshub";

export function useFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: async (): Promise<Facility[]> => {
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Facility[];
    },
  });
}

export function useFacility(id: string) {
  return useQuery({
    queryKey: ["facility", id],
    queryFn: async (): Promise<Facility | null> => {
      const { data, error } = await supabase.from("facilities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Facility) ?? null;
    },
    enabled: Boolean(id),
  });
}

/** All confirmed bookings for a facility on a date — used to compute slot availability. */
export function useFacilityDayBookings(facilityId: string, date: string) {
  return useQuery({
    queryKey: ["facility-bookings", facilityId, date],
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("facility_id", facilityId)
        .eq("booking_date", date)
        .eq("status", "confirmed");
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: Boolean(facilityId && date),
    refetchInterval: 20000,
  });
}

/** Confirmed bookings across all facilities for a date (availability counters). */
export function useDayBookings(date: string) {
  return useQuery({
    queryKey: ["day-bookings", date],
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("booking_date", date)
        .eq("status", "confirmed");
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: Boolean(date),
  });
}

export function useMyBookings(userId?: string) {
  return useQuery({
    queryKey: ["my-bookings", userId],
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", userId!)
        .order("booking_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
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
    queryFn: async (): Promise<WaitlistEntry[]> => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("id, facility_id, booking_date, start_time, end_time, status, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WaitlistEntry[];
    },
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
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, kind, read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: Boolean(userId),
    refetchInterval: 30000,
  });
}

/** Admin: all confirmed/cancelled bookings in a date window. */
export function useAllBookings(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["all-bookings", fromDate, toDate],
    queryFn: async (): Promise<Booking[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .gte("booking_date", fromDate)
        .lte("booking_date", toDate);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });
}
