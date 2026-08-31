import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
