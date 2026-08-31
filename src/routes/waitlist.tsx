import { createFileRoute, Link } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFacilities, useMyWaitlist } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import { formatRange, longDate } from "@/lib/sportshub";

export const Route = createFileRoute("/waitlist")({
  head: () => ({
    meta: [
      { title: "My Waitlist — SportsHub" },
      {
        name: "description",
        content: "See the full slots you're queued for. SportsHub notifies you the second a reserved slot is released.",
      },
      { property: "og:title", content: "My Waitlist — SportsHub" },
      { property: "og:description", content: "Queued slots and your position in line." },
    ],
  }),
  component: () => (
    <AppShell>
      <WaitlistPage />
    </AppShell>
  ),
});

function WaitlistPage() {
  const { user } = useAuth();
  const waitlistQuery = useMyWaitlist(user?.id);
  const facilitiesQuery = useFacilities();

  const entries = waitlistQuery.data ?? [];
  const facilities = facilitiesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">My Waitlist</h1>
        <p className="text-sm text-muted-foreground">
          When a booked slot is cancelled, everyone waiting is notified instantly — first come, first served.
        </p>
      </header>

      {waitlistQuery.isLoading ? (
        <LoadingState label="Loading your waitlist..." />
      ) : waitlistQuery.isError ? (
        <ErrorState message="Unable to load your waitlist. Please try again." onRetry={() => waitlistQuery.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Hourglass className="size-5" />}
          title="You're not waiting on anything"
          description="If a slot you want is already booked, tap it and join the waitlist — we'll alert you if it frees up."
          action={
            <Link to="/explore">
              <Button size="sm">Find a slot</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const facility = facilities.find((f) => f.id === entry.facility_id);
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold">{facility?.name ?? "Facility"}</h2>
                    <Badge variant={entry.status === "waiting" ? "secondary" : "default"} className="uppercase">
                      {entry.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {longDate(entry.booking_date)} · {formatRange(entry.start_time, entry.end_time)}
                  </p>
                </div>
                <Link
                  to="/facilities/$id"
                  params={{ id: entry.facility_id }}
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    Check availability
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
