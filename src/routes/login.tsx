import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { signInFn } from "@/lib/auth.server";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to SportsHub" },
      {
        name: "description",
        content: "Sign in with your college email to book badminton, tennis, basketball, football and gym slots.",
      },
      { property: "og:title", content: "Sign in to SportsHub" },
      { property: "og:description", content: "Book campus sports facilities in seconds with SportsHub." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await signInFn({ data: { email: email.trim(), password } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await refresh();
      toast.success("Welcome back to SportsHub.");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Something went wrong signing in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-hero-gradient p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent-gradient font-display text-sm font-bold text-primary-foreground">
            SH
          </span>
          <span className="font-display text-lg font-semibold">SportsHub</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-4xl font-semibold leading-tight">Book your game. Own your time.</h1>
          <p className="text-sm text-muted-foreground">
            Live availability across every campus court and ground, with database-level protection so two students can
            never hold the same slot.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Trophy className="size-4 text-primary" /> 7 facilities · hourly slots · instant confirmation
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Campus Sports & Wellness Office</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="font-display text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use your college email to access SportsHub.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">College email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>

          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Demo accounts</p>
            <p>Student — student@college.edu / sportshub123</p>
            <p>Admin — admin@college.edu / sportshub123</p>
            <p className="mt-1">
              Sign up with these exact emails once to create them; the admin account is granted admin rights
              automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
