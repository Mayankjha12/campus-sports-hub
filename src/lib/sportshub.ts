import badminton from "@/assets/badminton.jpg";
import basketball from "@/assets/basketball.jpg";
import cricket from "@/assets/cricket.jpg";
import football from "@/assets/football.jpg";
import gym from "@/assets/gym.jpg";
import tennis from "@/assets/tennis.jpg";

export type FacilityStatus = "open" | "closed" | "maintenance";
export type BookingStatus = "confirmed" | "cancelled" | "completed";

export interface Facility {
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

export interface Booking {
  id: string;
  reference: string;
  user_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  created_at: string;
}

const IMAGES: Record<string, string> = {
  badminton,
  tennis,
  basketball,
  football,
  cricket,
  gym,
};

export function facilityImage(key: string): string {
  return IMAGES[key] ?? badminton;
}

export const SPORT_CATEGORIES = [
  { sport: "Badminton", emoji: "🏸" },
  { sport: "Tennis", emoji: "🎾" },
  { sport: "Basketball", emoji: "🏀" },
  { sport: "Football", emoji: "⚽" },
  { sport: "Cricket", emoji: "🏏" },
  { sport: "Gymnasium", emoji: "🏋" },
];

/** ISO date (yyyy-mm-dd) for a day offset from today, in local time. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nextDates(count = 7): string[] {
  return Array.from({ length: count }, (_, i) => isoDate(i));
}

export function dayLabel(iso: string): string {
  const today = isoDate(0);
  const tomorrow = isoDate(1);
  if (iso === today) return "Today";
  if (iso === tomorrow) return "Tomorrow";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** "18:00:00" -> "6:00 PM" */
export function formatTime(value: string): string {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m ?? "00"} ${suffix}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export interface SlotDef {
  start: string;
  end: string;
  hour: number;
}

export function buildSlots(facility: Pick<Facility, "open_hour" | "close_hour">): SlotDef[] {
  const slots: SlotDef[] = [];
  for (let h = facility.open_hour; h < facility.close_hour; h++) {
    slots.push({
      start: `${String(h).padStart(2, "0")}:00:00`,
      end: `${String(h + 1).padStart(2, "0")}:00:00`,
      hour: h,
    });
  }
  return slots;
}

/** A slot in the past (today only) can no longer be booked. */
export function isPastSlot(date: string, startTime: string): boolean {
  const now = new Date();
  const slotStart = new Date(`${date}T${startTime}`);
  return slotStart.getTime() <= now.getTime();
}

export type SlotState = "available" | "booked" | "maintenance" | "past" | "selected";
