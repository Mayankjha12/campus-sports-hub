import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Hash, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { facilityImage, formatRange, longDate, type Booking, type Facility } from "@/lib/sportshub";

const STATUS_VARIANT: Record<Booking["status"], "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export function BookingCard({
  booking,
  facility,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  facility?: Facility | undefined;
  onCancel?: ((booking: Booking) => void) | undefined;
  cancelling?: boolean | undefined;
}) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:p-5">
      <img
        src={facilityImage(facility?.image_key ?? "badminton")}
        alt={facility?.name ?? "Facility"}
        width={1280}
        height={800}
        loading="lazy"
        className="h-32 w-full shrink-0 rounded-xl object-cover sm:size-24"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-semibold">{facility?.name ?? "Facility"}</h3>
          <Badge variant={STATUS_VARIANT[booking.status]} className="uppercase">
            {booking.status}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {longDate(booking.booking_date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" /> {formatRange(booking.start_time, booking.end_time)}
          </span>
          {facility ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {facility.location}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <Hash className="size-3.5" /> {booking.reference}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {facility ? (
          <Link to="/facilities/$id" params={{ id: facility.id }}>
            <Button variant="outline" size="sm">
              View facility
            </Button>
          </Link>
        ) : null}
        {booking.status === "confirmed" && onCancel ? (
          <Button variant="destructive" size="sm" disabled={cancelling} onClick={() => onCancel(booking)}>
            {cancelling ? "Cancelling..." : "Cancel booking"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
