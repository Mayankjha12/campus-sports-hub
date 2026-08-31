import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BookingCard } from "@/components/booking/BookingCard";
import { AppShell } from "@/components/shared/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFacilities, useMyBookings } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import { cancelBooking } from "@/lib/booking.functions";
import { isPastSlot, type Booking } from "@/lib/sportshub";

export const Route = createFileRoute("/bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — SportsHub" },
      {
        name: "description",
        content: "Track upcoming, completed and cancelled facility bookings, and cancel a slot to release it instantly.",
      },
      { property: "og:title", content: "My Bookings — SportsHub" },
      { property: "og:description", content: "Every slot you've reserved on campus, in one place." },
    ],
  }),
  component: () => (
    <AppShell>
      <BookingsPage />
    </AppShell>
  ),
});

function BookingsPage() {
  const { user } = useAuth();
  const bookingsQuery = useMyBookings(user?.id);
  const facilitiesQuery = useFacilities();
  const queryClient = useQueryClient();
  const cancel = useServerFn(cancelBooking);

  const [target, setTarget] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);

  const bookings = bookingsQuery.data ?? [];
  const facilities = facilitiesQuery.data ?? [];
  const facilityOf = (id: string) => facilities.find((f) => f.id === id);

  const upcoming = bookings.filter((b) => b.status === "confirmed" && !isPastSlot(b.booking_date, b.start_time));
  const completed = bookings.filter(
    (b) => b.status === "completed" || (b.status === "confirmed" && isPastSlot(b.booking_date, b.start_time)),
  );
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const confirmCancel = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await cancel({ data: { bookingId: target.id } });
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      void queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["day-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["facility-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      toast.error("Unable to cancel right now. Please try again.");
    } finally {
      setBusy(false);
      setTarget(null);
    }
  };

  const list = (rows: Booking[], emptyTitle: string, emptyText: string) => {
    if (bookingsQuery.isLoading) return <LoadingState label="Loading your bookings..." />;
    if (bookingsQuery.isError)
      return <ErrorState message="Unable to load your bookings. Please try again." onRetry={() => bookingsQuery.refetch()} />;
    if (rows.length === 0)
      return (
        <EmptyState
          icon={<CalendarCheck className="size-5" />}
          title={emptyTitle}
          description={emptyText}
          action={
            <Link to="/explore">
              <Button size="sm">Explore facilities</Button>
            </Link>
          }
        />
      );
    return (
      <div className="space-y-4">
        {rows.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            facility={facilityOf(booking.facility_id)}
            onCancel={booking.status === "confirmed" ? setTarget : undefined}
            cancelling={busy && target?.id === booking.id}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">My Bookings</h1>
        <p className="text-sm text-muted-foreground">
          {upcoming.length} upcoming · {completed.length} completed · {cancelled.length} cancelled
        </p>
      </header>

      <Tabs defaultValue="upcoming" className="space-y-5">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="upcoming" className="flex-1 sm:flex-none">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 sm:flex-none">
            Completed
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="flex-1 sm:flex-none">
            Cancelled
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          {list(upcoming, "No upcoming bookings", "Reserve a court or ground and it will appear here instantly.")}
        </TabsContent>
        <TabsContent value="completed">
          {list(completed, "Nothing played yet", "Once your slots finish, they move here as part of your history.")}
        </TabsContent>
        <TabsContent value="cancelled">
          {list(cancelled, "No cancellations", "Bookings you cancel will be listed here for your records.")}
        </TabsContent>
      </Tabs>

      <AlertDialog open={Boolean(target)} onOpenChange={(open) => (!open ? setTarget(null) : null)}>
        <AlertDialogContent className="max-w-[min(94vw,26rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              The slot is released immediately and anyone on the waitlist is notified. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} disabled={busy}>
              {busy ? "Cancelling..." : "Cancel booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
