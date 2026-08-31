import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Dumbbell,
  Loader2,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { computeSlots, SlotGrid, type SlotView } from "@/components/booking/SlotGrid";
import { AppShell } from "@/components/shared/AppShell";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDayBookings, useFacilities, useFacility, useMyBookings } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import { bookSlot, joinWaitlist } from "@/lib/booking.functions";
import {
  buildSlots,
  dayLabel,
  facilityImage,
  formatRange,
  formatTime,
  isPastSlot,
  isoDate,
  longDate,
  nextDates,
  type Facility,
} from "@/lib/sportshub";

export const Route = createFileRoute("/facilities/$id")({
  head: () => ({
    meta: [
      { title: "Facility availability — SportsHub" },
      {
        name: "description",
        content:
          "See live hourly availability for this campus facility, pick a slot and confirm your booking with instant conflict protection.",
      },
      { property: "og:title", content: "Facility availability — SportsHub" },
      { property: "og:description", content: "Pick a date, tap a free slot, confirm. No double bookings." },
    ],
  }),
  component: () => (
    <AppShell>
      <FacilityPage />
    </AppShell>
  ),
});

function icsHref(facility: Facility, date: string, start: string, end: string, reference: string) {
  const stamp = (time: string) => `${date.replace(/-/g, "")}T${time.replace(/:/g, "")}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SportsHub//Campus Booking//EN",
    "BEGIN:VEVENT",
    `UID:${reference}@sportshub`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${facility.sport} at ${facility.name}`,
    `LOCATION:${facility.location}`,
    `DESCRIPTION:SportsHub booking ${reference}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function FacilityPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const facilityQuery = useFacility(id);
  const facilitiesQuery = useFacilities();
  const [date, setDate] = useState(isoDate(0));
  const bookingsQuery = useDayBookings(date);
  const myBookingsQuery = useMyBookings(user?.id);

  const [selected, setSelected] = useState<SlotView | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflictSlot, setConflictSlot] = useState<SlotView | null>(null);

  const book = useServerFn(bookSlot);
  const waitlist = useServerFn(joinWaitlist);

  const facility = facilityQuery.data;
  const facilities = facilitiesQuery.data ?? [];
  const dayBookings = bookingsQuery.data ?? [];

  useEffect(() => {
    setSelected(null);
    setConflictSlot(null);
  }, [date, id]);

  const slots = useMemo(() => {
    if (!facility) return [];
    const facilityBookings = dayBookings.filter((b) => b.facility_id === facility.id);
    const booked = new Set(facilityBookings.map((b) => b.start_time));
    const mine = new Set(
      (myBookingsQuery.data ?? [])
        .filter((b) => b.facility_id === facility.id && b.booking_date === date && b.status === "confirmed")
        .map((b) => b.start_time),
    );
    return computeSlots(facility, date, booked, mine);
  }, [facility, dayBookings, myBookingsQuery.data, date]);

  const alternatives = useMemo(() => {
    if (!conflictSlot || !facility) return [];
    const options: { facility: Facility; start: string; end: string }[] = [];
    const sameSport = facilities.filter((f) => f.sport === facility.sport && f.status === "open");
    for (const f of sameSport) {
      const booked = new Set(dayBookings.filter((b) => b.facility_id === f.id).map((b) => b.start_time));
      for (const slot of buildSlots(f)) {
        if (booked.has(slot.start) || isPastSlot(date, slot.start)) continue;
        if (f.id === facility.id && slot.start === conflictSlot.start) continue;
        options.push({ facility: f, start: slot.start, end: slot.end });
      }
    }
    const target = Number(conflictSlot.start.slice(0, 2));
    return options
      .sort((a, b) => {
        const da = Math.abs(Number(a.start.slice(0, 2)) - target) + (a.facility.id === facility.id ? 0 : 0.5);
        const db = Math.abs(Number(b.start.slice(0, 2)) - target) + (b.facility.id === facility.id ? 0 : 0.5);
        return da - db;
      })
      .slice(0, 3);
  }, [conflictSlot, facility, facilities, dayBookings, date]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["day-bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const onSelect = (slot: SlotView) => {
    if (slot.state === "booked") {
      setSelected(null);
      setConflictSlot(slot);
      return;
    }
    setConflictSlot(null);
    setSelected((current) => (current?.start === slot.start ? null : slot));
  };

  const confirm = async () => {
    if (!facility || !selected) return;
    setBusy(true);
    try {
      const result = await book({
        data: { facilityId: facility.id, bookingDate: date, startTime: selected.start },
      });
      if (result.ok) {
        setConfirmOpen(false);
        setSuccessRef(result.reference);
        toast.success(result.idempotent ? "You already hold this slot." : "Booking confirmed successfully.");
        refresh();
      } else {
        setConfirmOpen(false);
        if (result.code === "conflict") {
          toast.error("This slot was just booked by another student.");
          setConflictSlot(selected);
          setSelected(null);
        } else {
          toast.error(result.message);
        }
        refresh();
      }
    } catch {
      toast.error("Unable to complete the booking. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const join = async (slot: SlotView) => {
    if (!facility) return;
    setBusy(true);
    try {
      const result = await waitlist({
        data: { facilityId: facility.id, bookingDate: date, startTime: slot.start },
      });
      if (result.ok) {
        toast.success(result.message);
        void queryClient.invalidateQueries({ queryKey: ["my-waitlist"] });
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Could not join the waitlist. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (facilityQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <LoadingState label="Checking availability..." />
      </div>
    );
  }

  if (facilityQuery.isError || !facility) {
    return (
      <ErrorState
        message="We couldn't load this facility. It may have been removed."
        onRetry={() => facilityQuery.refetch()}
      />
    );
  }

  const successBooking = successRef
    ? (myBookingsQuery.data ?? []).find((b) => b.reference === successRef)
    : undefined;

  return (
    <div className="space-y-8 pb-28 lg:pb-0">
      <Link to="/explore" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Explore
      </Link>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <img
            src={facilityImage(facility.image_key)}
            alt={`${facility.name} at ${facility.location}`}
            width={1280}
            height={800}
            className="aspect-16/9 w-full rounded-2xl object-cover shadow-card"
          />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{facility.sport}</Badge>
            {facility.status !== "open" ? (
              <Badge variant="destructive" className="uppercase">
                {facility.status}
              </Badge>
            ) : (
              <Badge className="bg-success/20 text-success">Open for bookings</Badge>
            )}
          </div>
          <h1 className="font-display text-2xl font-semibold uppercase tracking-tight sm:text-3xl">{facility.name}</h1>
          <p className="text-sm text-muted-foreground">{facility.description}</p>
          <Separator />
          <dl className="grid gap-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Location</dt>
                <dd>{facility.location}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</dt>
                <dd>{facility.capacity} players</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Operating hours</dt>
                <dd>
                  {formatTime(`${String(facility.open_hour).padStart(2, "0")}:00`)} –{" "}
                  {formatTime(`${String(facility.close_hour).padStart(2, "0")}:00`)}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Dumbbell className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Available equipment</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {facility.equipment.map((item) => (
                    <Badge key={item} variant="secondary" className="font-normal">
                      {item}
                    </Badge>
                  ))}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Choose a date</h2>
          <p className="text-xs text-muted-foreground">Slots refresh automatically every 20 seconds</p>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {nextDates(7).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                d === date
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Slots for {longDate(date)}</h2>
        {bookingsQuery.isLoading ? (
          <LoadingState label="Checking availability..." />
        ) : bookingsQuery.isError ? (
          <ErrorState message="Unable to load availability. Please try again." onRetry={() => bookingsQuery.refetch()} />
        ) : (
          <SlotGrid slots={slots} selected={selected?.start ?? null} onSelect={onSelect} />
        )}
      </section>

      {conflictSlot ? (
        <section className="space-y-4 rounded-2xl border border-warning/40 bg-warning/10 p-5">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold">
              {formatRange(conflictSlot.start, conflictSlot.end)} is currently full.
            </h2>
            <p className="text-sm text-muted-foreground">
              Join the waitlist and we'll notify you the moment it frees up, or take one of these open alternatives.
            </p>
          </div>
          <Button size="sm" onClick={() => join(conflictSlot)} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Join Waitlist
          </Button>
          {alternatives.length > 0 ? (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3.5" /> Recommended alternatives
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {alternatives.map((alt) => (
                  <button
                    key={`${alt.facility.id}-${alt.start}`}
                    type="button"
                    className="rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/60"
                    onClick={() => {
                      if (alt.facility.id === facility.id) {
                        setConflictSlot(null);
                        setSelected({ start: alt.start, end: alt.end, hour: Number(alt.start.slice(0, 2)), state: "available", mine: false });
                      } else {
                        navigate({ to: "/facilities/$id", params: { id: alt.facility.id } });
                      }
                    }}
                  >
                    <p className="text-sm font-semibold">{alt.facility.name}</p>
                    <p className="text-xs text-muted-foreground">{formatRange(alt.start, alt.end)}</p>
                    <p className="mt-1 text-xs font-medium text-success">Available</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-xl lg:static lg:rounded-2xl lg:border lg:px-5 lg:py-4 lg:shadow-card">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
              <p className="truncate text-sm font-semibold">
                {facility.name} · {formatRange(selected.start, selected.end)}
              </p>
              <p className="text-xs text-muted-foreground">{longDate(date)}</p>
            </div>
            <Button size="lg" className="w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>
              Confirm Booking
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-[min(94vw,26rem)]">
          <DialogHeader>
            <DialogTitle>Confirm your booking?</DialogTitle>
            <DialogDescription>The slot is reserved only once the database confirms it.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <Row label="Facility" value={facility.name} />
            <Row label="Date" value={longDate(date)} />
            <Row label="Time" value={selected ? formatRange(selected.start, selected.end) : "—"} />
            <Row label="Duration" value="1 hour" />
          </dl>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Back
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(successRef)}
        onOpenChange={(open) => {
          if (!open) {
            setSuccessRef(null);
            setSelected(null);
          }
        }}
      >
        <DialogContent className="max-w-[min(94vw,26rem)]">
          <DialogHeader className="items-center text-center">
            <CheckCircle2 className="size-12 animate-pop text-success" />
            <DialogTitle className="mt-2">Booking Confirmed</DialogTitle>
            <DialogDescription>Your slot is locked in. See you on court.</DialogDescription>
          </DialogHeader>
          <dl className="animate-rise space-y-2 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
            <Row label="Facility" value={facility.name} />
            <Row label="Date" value={longDate(successBooking?.booking_date ?? date)} />
            <Row
              label="Time"
              value={
                successBooking
                  ? formatRange(successBooking.start_time, successBooking.end_time)
                  : selected
                    ? formatRange(selected.start, selected.end)
                    : "—"
              }
            />
            <Row label="Booking ID" value={successRef ?? "—"} />
          </dl>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Link to="/bookings" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">
                View Booking
              </Button>
            </Link>
            <a
              className="w-full sm:w-auto"
              href={
                successRef
                  ? icsHref(
                      facility,
                      successBooking?.booking_date ?? date,
                      successBooking?.start_time ?? selected?.start ?? "18:00:00",
                      successBooking?.end_time ?? selected?.end ?? "19:00:00",
                      successRef,
                    )
                  : "#"
              }
              download={`sportshub-${successRef ?? "booking"}.ics`}
            >
              <Button variant="outline" className="w-full">
                <CalendarPlus className="mr-2 size-4" /> Add to Calendar
              </Button>
            </a>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setSuccessRef(null);
                setSelected(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
