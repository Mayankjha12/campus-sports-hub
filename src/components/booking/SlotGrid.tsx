import { Check, Lock, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { buildSlots, formatRange, isPastSlot, type Facility, type SlotDef } from "@/lib/sportshub";

export interface SlotView extends SlotDef {
  state: "available" | "booked" | "maintenance" | "past";
  mine: boolean;
}

export function computeSlots(
  facility: Facility,
  date: string,
  bookedStartTimes: Set<string>,
  myStartTimes: Set<string> = new Set(),
): SlotView[] {
  return buildSlots(facility).map((slot) => {
    let state: SlotView["state"] = "available";
    if (facility.status !== "open") state = "maintenance";
    else if (bookedStartTimes.has(slot.start)) state = "booked";
    else if (isPastSlot(date, slot.start)) state = "past";
    return { ...slot, state, mine: myStartTimes.has(slot.start) };
  });
}

export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: SlotView[];
  selected: string | null;
  onSelect: (slot: SlotView) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {slots.map((slot) => {
        const isSelected = selected === slot.start;
        const disabled = slot.state === "past" || slot.state === "maintenance";
        const label =
          slot.state === "maintenance"
            ? "MAINTENANCE"
            : slot.state === "past"
              ? "PASSED"
              : slot.state === "booked"
                ? slot.mine
                  ? "YOUR BOOKING"
                  : "BOOKED"
                : isSelected
                  ? "SELECTED"
                  : "AVAILABLE";

        return (
          <button
            key={slot.start}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(slot)}
            aria-pressed={isSelected}
            className={cn(
              "flex min-h-20 flex-col items-start justify-center gap-1 rounded-xl border px-3 py-3 text-left transition-all",
              "border-border bg-secondary/40 hover:border-primary/60 hover:bg-secondary",
              slot.state === "booked" && "border-destructive/40 bg-destructive/10 hover:border-destructive/60",
              slot.state === "maintenance" && "border-warning/40 bg-warning/10 opacity-70",
              slot.state === "past" && "opacity-45",
              isSelected && "border-primary bg-primary/15 ring-2 ring-primary/40",
              disabled && "cursor-not-allowed hover:border-border hover:bg-secondary/40",
            )}
          >
            <span className="text-sm font-semibold leading-tight">{formatRange(slot.start, slot.end)}</span>
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide",
                slot.state === "available" && !isSelected && "text-success",
                isSelected && "text-primary",
                slot.state === "booked" && "text-destructive",
                slot.state === "maintenance" && "text-warning",
                slot.state === "past" && "text-muted-foreground",
              )}
            >
              {isSelected ? <Check className="size-3" /> : null}
              {slot.state === "booked" ? <Lock className="size-3" /> : null}
              {slot.state === "maintenance" ? <Wrench className="size-3" /> : null}
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
