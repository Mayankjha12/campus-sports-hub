import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SportsHub — Book campus sports facilities" },
      { name: "description", content: "Discover campus courts and grounds, check live availability and lock in your slot." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return <Navigate to="/dashboard" replace />;
}
