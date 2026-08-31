import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Database, Loader2, ShieldCheck, XCircle, Zap } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/shared/AppShell";
import { StatCard } from "@/components/shared/StatCard";
import { LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useFacilities } from "@/hooks/use-sportshub";
import { demoBookAttempt, demoRunSummary } from "@/lib/booking.functions";
import { isoDate } from "@/lib/sportshub";

export const Route = createFileRoute("/concurrency-demo")({
  head: () => ({
    meta: [
      { title: "Concurrency Demo — SportsHub" },
      {
        name: "description",
        content:
          "Fire simultaneous booking requests at one slot and watch the database guarantee that exactly one succeeds — no double bookings, ever.",
      },
      { property: "og:title", content: "Concurrency Demo — SportsHub" },
      {
        property: "og:description",
        content: "Simulate 2-10 students racing for the same slot. Exactly one booking is created.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ConcurrencyDemoPage />
    </AppShell>
  ),
});

type Attempt = {
  actor: string;
  status: "pending" | "booked" | "conflict" | "error";
  detail: string;
};

function ConcurrencyDemoPage() {
  const facilitiesQuery = useFacilities();
  const facilities = facilitiesQuery.data ?? [];
  const attempt = useServerFn(demoBookAttempt);
  const summary = useServerFn(demoRunSummary);

  const [facilityId, setFacilityId] = useState("");
  const [users, setUsers] = useState(5);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [running, setRunning] = useState(false);
  const [rowsCreated, setRowsCreated] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const activeFacility = facilities.find((f) => f.id === facilityId) ?? facilities[0];

  const run = async () => {
    if (!activeFacility) return;
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const actors = Array.from({ length: users }, (_, i) => `Student ${i + 1}`);
    setRunning(true);
    setRowsCreated(null);
    setElapsed(null);
    setAttempts(actors.map((actor) => ({ actor, status: "pending", detail: "Sending request..." })));

    const started = performance.now();
    const results = await Promise.all(
      actors.map((actor) =>
        attempt({
          data: {
            runId,
            facilityId: activeFacility.id,
            bookingDate: isoDate(1),
            startTime: "18:00",
            actor,
          },
        }).catch(() => ({ actor, status: "error" as const, detail: "Request failed" })),
      ),
    );
    const took = Math.round(performance.now() - started);

    setAttempts(
      actors.map((actor) => {
        const result = results.find((r) => r.actor === actor);
        return {
          actor,
          status: result?.status ?? "error",
          detail: result?.detail ?? "Request failed",
        };
      }),
    );

    const verified = await summary({ data: { runId } }).catch(() => ({ count: -1 }));
    setRowsCreated(verified.count);
    setElapsed(took);
    setRunning(false);
  };

  const booked = attempts.filter((a) => a.status === "booked").length;
  const rejected = attempts.filter((a) => a.status === "conflict").length;

  if (facilitiesQuery.isLoading) return <LoadingState label="Preparing the demo..." />;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Badge className="bg-primary/15 text-primary">
          <ShieldCheck className="mr-1 size-3.5" /> Race-condition proof
        </Badge>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Concurrency Demo</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every request below targets the exact same facility, date and time slot, fired in parallel. A unique database
          index on <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">(facility_id, booking_date, start_time)</code>{" "}
          makes the winner atomic: losers get Postgres error <strong>23505</strong> and a friendly rejection — never a
          duplicate row.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Target facility</label>
          <Select value={activeFacility?.id ?? ""} onValueChange={setFacilityId}>
            <SelectTrigger aria-label="Target facility">
              <SelectValue placeholder="Pick a facility" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id}>
                  {facility.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Slot: tomorrow, 6:00 PM – 7:00 PM</p>
        </div>
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Simultaneous users: {users}
          </label>
          <Slider min={2} max={10} step={1} value={[users]} onValueChange={([value]) => setUsers(value ?? 5)} />
          <Button onClick={run} disabled={running || !activeFacility} className="w-full">
            {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Zap className="mr-2 size-4" />}
            {running ? "Racing..." : `Fire ${users} simultaneous bookings`}
          </Button>
        </div>
      </section>

      {attempts.length > 0 ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Requests sent" value={attempts.length} hint={elapsed !== null ? `${elapsed} ms round trip` : "In flight..."} icon={Zap} />
            <StatCard label="Bookings created" value={booked} hint="Exactly one may win" icon={CheckCircle2} />
            <StatCard label="Safely rejected" value={rejected} hint="Unique violation 23505" icon={ShieldCheck} />
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Request timeline</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {attempts.map((row) => (
                <li key={row.actor} className="flex items-center gap-3 px-4 py-3">
                  <span className="shrink-0">
                    {row.status === "pending" ? (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    ) : row.status === "booked" ? (
                      <CheckCircle2 className="size-5 text-success" />
                    ) : (
                      <XCircle className="size-5 text-destructive" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{row.actor}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{row.detail}</p>
                  </div>
                  <Badge
                    variant={row.status === "booked" ? "default" : row.status === "pending" ? "secondary" : "destructive"}
                    className="shrink-0 uppercase"
                  >
                    {row.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          {rowsCreated !== null ? (
            <section className="flex flex-col gap-2 rounded-2xl border border-success/40 bg-success/10 p-5">
              <p className="flex items-center gap-2 font-display text-base font-semibold">
                <Database className="size-4" /> Database verification
              </p>
              <p className="text-sm text-muted-foreground">
                Rows actually written for this run: <strong className="text-foreground">{rowsCreated}</strong>. The unique
                index guarantees this can never exceed 1, no matter how many students tap at the same millisecond.
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
