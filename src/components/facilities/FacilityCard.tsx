import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { facilityImage, type Facility } from "@/lib/sportshub";

export function FacilityCard({
  facility,
  availableSlots,
  totalSlots,
  ctaLabel = "View Availability",
}: {
  facility: Facility;
  availableSlots?: number;
  totalSlots?: number;
  ctaLabel?: string;
}) {
  const unavailable = facility.status !== "open";
  const statusLabel =
    facility.status === "maintenance" ? "Under maintenance" : facility.status === "closed" ? "Closed" : undefined;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-16/9 overflow-hidden">
        <img
          src={facilityImage(facility.image_key)}
          alt={`${facility.name} at ${facility.location}`}
          width={1280}
          height={800}
          loading="lazy"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-background/85 backdrop-blur">
            {facility.sport}
          </Badge>
          {statusLabel ? <Badge variant="destructive">{statusLabel}</Badge> : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-base font-semibold leading-tight">{facility.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{facility.location}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" /> Capacity {facility.capacity}
          </span>
          {typeof availableSlots === "number" ? (
            <span className={unavailable || availableSlots === 0 ? "text-destructive" : "text-success"}>
              {unavailable ? "No slots today" : `${availableSlots}${totalSlots ? `/${totalSlots}` : ""} slots free`}
            </span>
          ) : null}
        </div>

        <Link to="/facilities/$id" params={{ id: facility.id }} className="mt-auto block">
          <Button variant={unavailable ? "outline" : "default"} className="w-full">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </article>
  );
}
