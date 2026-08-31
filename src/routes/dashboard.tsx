import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, CalendarDays, Clock, MapPin, Sparkles } from "lucide-react";

import { FacilityCard } from "@/components/facilities/FacilityCard";
import { AppShell } from "@/components/shared/AppShell";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDayBookings, useFacilities, useMyBookings } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import {
  buildSlots,
  facilityImage,
  formatRange,
  isoDate,
  longDate,
  SPORT_CATEGORIES,
  isPastSlot,
} from "@/lib/sportshub";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SportsHub" },
      {
        name: "description",
        content:
          "Your SportsHub dashboard: upcoming bookings, popular facilities today and one-tap access to every campus sport.",
      },
      { property: "og:title", content: "Dashboard — SportsHub" },
      { property: "og:description", content: "Find your facility, choose your slot, and start playing." },
    ],
  }),
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});

function DashboardPage() {
  const { profile, user } = useAuth();
  const today = isoDate(0);
  const facilitiesQuery = useFacilities();
  const bookingsQuery = useDayBookings(today);
  const myBookingsQuery = useMyBookings(user?.id);

  const facilities = facilitiesQuery.data ?? [];
  const dayBookings = bookingsQuery.data ?? [];

  const upcoming = (myBookingsQuery.data ?? [])
    .filter((b) => b.status === "confirmed" && !isPastSlot(b.booking_date, b.start_time))
    .sort((a, b) => `${a.booking_date}${a.start_time}`.localeCompare(`${b.booking_date}${b.start_time}`))[0];
  const upcomingFacility = facilities.find((f) => f.id === upcoming?.facility_id);

  const availability = (facilityId: string) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (!facility) return { free: 0, total: 0 };
    const slots = buildSlots(facility);
    const booked = new Set(dayBookings.filter((b) => b.facility_id === facilityId).map((b) => b.start_time));
    const free = slots.filter((s) => !booked.has(s.start) && !isPastSlot(today, s.start)).length;
    return { free: facility.status === "open" ? free : 0, total: slots.length };
  };

  const popular = [...facilities]
    .filter((f) => f.status === "open")
    .sort((a, b) => availability(b.id).free - availability(a.id).free)
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-border bg-hero-gradient p-6 shadow-card sm:p-10">
        <Badge variant="secondary" className="mb-4 bg-background/70 backdrop-blur">
          <Sparkles className="mr-1.5 size-3.5" /> Hi {profile?.full_name?.split(" ")[0] || "there"}
        </Badge>
        <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
          Book your game. Own your time.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          Find your facility, choose your slot, and start playing.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/explore" className="sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              Book a Facility <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>
          <Link to="/bookings" className="sm:w-auto">
            <Button size="lg" variant="outline" className="w-full bg-background/40 sm:w-auto">
              View My Bookings
            </Button>
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Upcoming booking</h2>
        {myBookingsQuery.isLoading ? (
          <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ) : upcoming ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
            <img
              src={facilityImage(upcomingFacility?.image_key ?? "badminton")}
              alt={upcomingFacility?.name ?? "Facility"}
              width={1280}
              height={800}
              loading="lazy"
              className="h-32 w-full rounded-xl object-cover sm:size-24"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold">{upcomingFacility?.name}</h3>
                <Badge className="uppercase">{upcoming.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {longDate(upcoming.booking_date)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> {formatRange(upcoming.start_time, upcoming.end_time)}
                </span>
                {upcomingFacility ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {upcomingFacility.location}
                  </span>
                ) : null}
              </div>
            </div>
            <Link to="/bookings" className="shrink-0">
              <Button variant="outline" className="w-full sm:w-auto">
                View Booking
              </Button>
            </Link>
          </div>
        ) : (
          <EmptyState
            icon={<CalendarCheck className="size-5" />}
            title="No upcoming bookings"
            description="Pick a facility and lock in a slot — confirmation is instant."
            action={
              <Link to="/explore">
                <Button size="sm">Explore facilities</Button>
              </Link>
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Quick categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SPORT_CATEGORIES.map((cat) => (
            <Link key={cat.sport} to="/explore" search={{ sport: cat.sport }}>
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-5 text-center shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift">
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-xs font-medium sm:text-sm">{cat.sport}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Popular today</h2>
          <Link to="/explore" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {facilitiesQuery.isLoading ? (
          <CardSkeletonGrid count={3} />
        ) : facilitiesQuery.isError ? (
          <ErrorState message="Unable to load availability. Please try again." onRetry={() => facilitiesQuery.refetch()} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {popular.map((facility) => {
              const { free, total } = availability(facility.id);
              return (
                <FacilityCard
                  key={facility.id}
                  facility={facility}
                  availableSlots={free}
                  totalSlots={total}
                  ctaLabel="View Slots"
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
