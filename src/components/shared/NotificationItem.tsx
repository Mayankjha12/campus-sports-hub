import { BellRing, CalendarCheck, CalendarX, Clock, Sparkles, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";

const ICONS: Record<string, typeof BellRing> = {
  booking_confirmed: CalendarCheck,
  booking_cancelled: CalendarX,
  reminder: Clock,
  waitlist_available: Sparkles,
  waitlist_joined: BellRing,
  maintenance: Wrench,
};

export function NotificationItem({
  title,
  body,
  kind,
  created_at,
  read,
  compact,
}: {
  title: string;
  body: string;
  kind: string;
  created_at: string;
  read: boolean;
  compact?: boolean;
}) {
  const Icon = ICONS[kind] ?? BellRing;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:bg-secondary/60",
        !read && "border-primary/30 bg-primary/5",
      )}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{title}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(created_at)}</span>
        </div>
        <p className={cn("mt-1 text-xs text-muted-foreground", compact && "line-clamp-2")}>{body}</p>
      </div>
    </div>
  );
}
