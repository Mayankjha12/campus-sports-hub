import { createFileRoute, Link } from "@tanstack/react-router";
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
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-primary-foreground">SH</div>
            <span className="font-display text-xl font-semibold">SportsHub</span>
          </div>
          <Link to="/login"><Button variant="outline">Sign in</Button></Link>
        </header>
        <section className="my-auto overflow-hidden rounded-3xl border border-border bg-hero-gradient p-8 shadow-card sm:p-14 lg:p-20">
          <Badge variant="secondary" className="mb-6 bg-background/70 backdrop-blur"><Sparkles className="mr-1.5 size-3.5" /> Campus sports, simplified</Badge>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight text-balance sm:text-6xl">Book your game. Own your time.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Find your facility, choose your slot, and start playing. Live campus availability with instant booking confirmation.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/explore"><Button size="lg">Explore facilities <ArrowRight className="ml-2 size-4" /></Button></Link>
            <Link to="/signup"><Button size="lg" variant="outline" className="bg-background/40">Create an account</Button></Link>
          </div>
          <div className="mt-12 flex items-center gap-3 text-sm text-muted-foreground"><CalendarCheck className="size-5 text-primary" /> Live availability across campus courts and grounds</div>
        </section>
      </div>
    </main>
  );
}
