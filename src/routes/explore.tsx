import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { FacilityCard } from "@/components/facilities/FacilityCard";
import { AppShell } from "@/components/shared/AppShell";
import { CardSkeletonGrid, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDayBookings, useFacilities } from "@/hooks/use-sportshub";
import { buildSlots, dayLabel, isPastSlot, isoDate, nextDates } from "@/lib/sportshub";

const searchSchema = z.object({
  sport: z.string().optional(),
});

export const Route = createFileRoute("/explore")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Explore Facilities — SportsHub" },
      {
        name: "description",
        content:
          "Search and filter every campus sports facility by sport, date, location and live availability, then jump straight into slot booking.",
      },
      { property: "og:title", content: "Explore Facilities — SportsHub" },
      { property: "og:description", content: "Badminton, tennis, basketball, football, cricket and the campus gym." },
    ],
  }),
  component: () => (
    <AppShell>
      <ExplorePage />
    </AppShell>
  ),
});

function ExplorePage() {
  const { sport: sportParam } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState(sportParam ?? "all");
  const [date, setDate] = useState(isoDate(0));
  const [availability, setAvailability] = useState("all");
  const [location, setLocation] = useState("all");

  const facilitiesQuery = useFacilities();
  const bookingsQuery = useDayBookings(date);
  const facilities = facilitiesQuery.data ?? [];
  const dayBookings = bookingsQuery.data ?? [];

  const sports = useMemo(() => Array.from(new Set(facilities.map((f) => f.sport))).sort(), [facilities]);
  const locations = useMemo(() => Array.from(new Set(facilities.map((f) => f.location))).sort(), [facilities]);

  const withAvailability = facilities.map((facility) => {
    const slots = buildSlots(facility);
    const booked = new Set(dayBookings.filter((b) => b.facility_id === facility.id).map((b) => b.start_time));
    const free =
      facility.status === "open" ? slots.filter((s) => !booked.has(s.start) && !isPastSlot(date, s.start)).length : 0;
    return { facility, free, total: slots.length };
  });

  const results = withAvailability.filter(({ facility, free }) => {
    const q = query.trim().toLowerCase();
    if (q && !`${facility.name} ${facility.sport} ${facility.location}`.toLowerCase().includes(q)) return false;
    if (sport !== "all" && facility.sport !== sport) return false;
    if (location !== "all" && facility.location !== location) return false;
    if (availability === "available" && free === 0) return false;
    if (availability === "full" && free > 0) return false;
    return true;
  });

  const filters = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label>Sport</Label>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger>
            <SelectValue placeholder="All sports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Date</Label>
        <Select value={date} onValueChange={setDate}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {nextDates(7).map((d) => (
              <SelectItem key={d} value={d}>
                {dayLabel(d)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Availability</Label>
        <Select value={availability} onValueChange={setAvailability}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any availability</SelectItem>
            <SelectItem value="available">Slots available</SelectItem>
            <SelectItem value="full">Fully booked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Location</Label>
        <Select value={location} onValueChange={setLocation}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Explore Facilities</h1>
        <p className="text-sm text-muted-foreground">
          {results.length} facilit{results.length === 1 ? "y" : "ies"} · availability shown for {dayLabel(date)}
        </p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search facilities..."
            className="pl-9"
            aria-label="Search facilities"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Filters">
              <SlidersHorizontal className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="p-4">{filters}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden rounded-2xl border border-border bg-card p-5 shadow-card lg:block">{filters}</div>

      {facilitiesQuery.isLoading ? (
        <CardSkeletonGrid />
      ) : facilitiesQuery.isError ? (
        <ErrorState message="Unable to load availability. Please try again." onRetry={() => facilitiesQuery.refetch()} />
      ) : results.length === 0 ? (
        <EmptyState
          title="No facilities match your filters"
          description="Try clearing the search box or switching to another sport or date."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setQuery("");
                setSport("all");
                setAvailability("all");
                setLocation("all");
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.map(({ facility, free, total }) => (
            <FacilityCard key={facility.id} facility={facility} availableSlots={free} totalSlots={total} />
          ))}
        </div>
      )}
    </div>
  );
}
