import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, CalendarCheck, Percent, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/shared/AppShell";
import { StatCard } from "@/components/shared/StatCard";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllBookings, useFacilities } from "@/hooks/use-sportshub";
import { setFacilityStatusFn } from "@/lib/data.server";
import { buildSlots, facilityImage, formatRange, isoDate, longDate, type FacilityStatus } from "@/lib/sportshub";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — SportsHub" },
      {
        name: "description",
        content: "Facility utilisation analytics, peak-hour insight and maintenance controls for campus sports admins.",
      },
      { property: "og:title", content: "Admin Console — SportsHub" },
      { property: "og:description", content: "Utilisation, peak hours and facility status in one console." },
    ],
  }),
  component: () => (
    <AppShell adminOnly>
      <AdminPage />
    </AppShell>
  ),
});

const STATUSES: FacilityStatus[] = ["open", "maintenance", "closed"];

function AdminPage() {
  const from = isoDate(-6);
  const to = isoDate(7);
  const facilitiesQuery = useFacilities();
  const bookingsQuery = useAllBookings(from, to);
  const queryClient = useQueryClient();

  const facilities = facilitiesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const confirmed = bookings.filter((b) => b.status !== "cancelled");
  const today = isoDate(0);

  const stats = useMemo(() => {
    const capacityPerDay = facilities.reduce((sum, f) => sum + buildSlots(f).length, 0);
    const todays = confirmed.filter((b) => b.booking_date === today);
    const utilisation = capacityPerDay > 0 ? Math.round((todays.length / capacityPerDay) * 100) : 0;
    const cancelRate =
      bookings.length > 0 ? Math.round((bookings.filter((b) => b.status === "cancelled").length / bookings.length) * 100) : 0;
    return { capacityPerDay, todayCount: todays.length, utilisation, cancelRate };
  }, [facilities, confirmed, bookings, today]);

  const perFacility = useMemo(() => {
    return facilities
      .map((facility) => {
        const slotsPerDay = buildSlots(facility).length;
        const rows = confirmed.filter((b) => b.facility_id === facility.id);
        const capacity = slotsPerDay * 14;
        const rate = capacity > 0 ? Math.round((rows.length / capacity) * 100) : 0;
        return { facility, count: rows.length, rate };
      })
      .sort((a, b) => b.count - a.count);
  }, [facilities, confirmed]);

  const peakHours = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const booking of confirmed) {
      buckets.set(booking.start_time, (buckets.get(booking.start_time) ?? 0) + 1);
    }
    const max = Math.max(1, ...buckets.values());
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([start, count]) => ({ start, count, share: Math.round((count / max) * 100) }));
  }, [confirmed]);

  const upcoming = useMemo(
    () =>
      confirmed
        .filter((b) => b.booking_date >= today)
        .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time))
        .slice(0, 12),
    [confirmed, today],
  );

  const setStatus = async (facilityId: string, status: FacilityStatus) => {
    try {
      await setFacilityStatusFn({ data: { facilityId, status } });
    } catch {
      toast.error("Could not update the facility status.");
      return;
    }
    toast.success(`Facility marked as ${status}.`);
    void queryClient.invalidateQueries({ queryKey: ["facilities"] });
  };

  if (facilitiesQuery.isLoading || bookingsQuery.isLoading) {
    return <LoadingState label="Crunching facility analytics..." />;
  }

  if (facilitiesQuery.isError || bookingsQuery.isError) {
    return (
      <ErrorState
        message="Unable to load admin analytics. Please try again."
        onRetry={() => {
          void facilitiesQuery.refetch();
          void bookingsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Admin Console</h1>
        <p className="text-sm text-muted-foreground">
          Utilisation across {facilities.length} facilities · {longDate(from)} to {longDate(to)}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bookings today" value={stats.todayCount} hint={`${stats.capacityPerDay} slots available daily`} icon={CalendarCheck} />
        <StatCard label="Today's utilisation" value={`${stats.utilisation}%`} hint="Confirmed slots vs capacity" icon={Percent} />
        <StatCard label="Total bookings" value={confirmed.length} hint="Across the 2-week window" icon={TrendingUp} />
        <StatCard label="Cancellation rate" value={`${stats.cancelRate}%`} hint="Cancelled vs all bookings" icon={Activity} />
      </section>

      <Tabs defaultValue="utilisation" className="space-y-5">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="utilisation" className="flex-1 sm:flex-none">
            Utilisation
          </TabsTrigger>
          <TabsTrigger value="facilities" className="flex-1 sm:flex-none">
            Facilities
          </TabsTrigger>
          <TabsTrigger value="bookings" className="flex-1 sm:flex-none">
            Bookings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="utilisation" className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-base font-semibold">Most booked facilities</h2>
            <ul className="mt-4 space-y-4">
              {perFacility.map(({ facility, count, rate }) => (
                <li key={facility.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{facility.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {count} bookings · {rate}%
                    </span>
                  </div>
                  <Progress value={rate} />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-base font-semibold">Peak hours</h2>
            {peakHours.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No bookings recorded in this window yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {peakHours.map((hour) => (
                  <li key={hour.start} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{formatRange(hour.start, hour.start)}</span>
                      <span className="text-muted-foreground">{hour.count} bookings</span>
                    </div>
                    <Progress value={hour.share} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="facilities">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {facilities.map((facility) => (
              <article key={facility.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <img
                  src={facilityImage(facility.image_key)}
                  alt={facility.name}
                  width={1280}
                  height={800}
                  loading="lazy"
                  className="aspect-16/9 w-full object-cover"
                />
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-base font-semibold">{facility.name}</h3>
                    <Badge variant="secondary">{facility.sport}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {facility.location} · capacity {facility.capacity}
                  </p>
                  <Select value={facility.status} onValueChange={(value) => setStatus(facility.id, value as FacilityStatus)}>
                    <SelectTrigger aria-label={`Status for ${facility.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bookings">
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Facility</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No upcoming bookings yet.
                    </td>
                  </tr>
                ) : (
                  upcoming.map((booking) => (
                    <tr key={booking.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {facilities.find((f) => f.id === booking.facility_id)?.name ?? "Facility"}
                      </td>
                      <td className="px-4 py-3">{longDate(booking.booking_date)}</td>
                      <td className="px-4 py-3">{formatRange(booking.start_time, booking.end_time)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{booking.reference}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
