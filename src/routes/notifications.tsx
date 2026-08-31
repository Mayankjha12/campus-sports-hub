import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellOff } from "lucide-react";

import { AppShell } from "@/components/shared/AppShell";
import { NotificationItem } from "@/components/shared/NotificationItem";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-sportshub";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — SportsHub" },
      {
        name: "description",
        content: "Booking confirmations, cancellations, upcoming slot reminders and waitlist alerts in one feed.",
      },
      { property: "og:title", content: "Notifications — SportsHub" },
      { property: "og:description", content: "Every booking and waitlist update, newest first." },
    ],
  }),
  component: () => (
    <AppShell>
      <NotificationsPage />
    </AppShell>
  ),
});

function NotificationsPage() {
  const { user } = useAuth();
  const query = useNotifications(user?.id);
  const queryClient = useQueryClient();

  const rows = query.data ?? [];
  const unread = rows.filter((row) => !row.read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You're all caught up"}
          </p>
        </div>
        {unread > 0 ? (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all as read
          </Button>
        ) : null}
      </header>

      {query.isLoading ? (
        <LoadingState label="Loading notifications..." />
      ) : query.isError ? (
        <ErrorState message="Unable to load notifications. Please try again." onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<BellOff className="size-5" />}
          title="No notifications yet"
          description="Confirmations, reminders and waitlist alerts will show up here as soon as you start booking."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              <NotificationItem
                title={row.title}
                body={row.body}
                kind={row.kind}
                created_at={row.created_at}
                read={row.read}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
