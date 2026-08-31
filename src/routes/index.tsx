import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingState } from "@/components/shared/states";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SportsHub — Book campus sports facilities" },
      {
        name: "description",
        content:
          "Discover campus courts and grounds, check live availability and lock in your slot. Database-enforced booking means no double bookings, ever.",
      },
      { property: "og:title", content: "SportsHub — Book campus sports facilities" },
      {
        property: "og:description",
        content: "Book your game. Own your time. Real-time campus sports facility booking for students.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({ to: session ? "/dashboard" : "/login", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="font-display text-3xl font-semibold">SportsHub</h1>
        <p className="text-sm text-muted-foreground">Book your game. Own your time.</p>
        <LoadingState label="Loading SportsHub..." />
      </div>
    </div>
  );
}
