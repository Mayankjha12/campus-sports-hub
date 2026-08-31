import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { signUpFn } from "@/lib/auth.server";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your SportsHub account" },
      {
        name: "description",
        content: "Register with your college email and student ID to start booking campus sports facilities.",
      },
      { property: "og:title", content: "Create your SportsHub account" },
      { property: "og:description", content: "Join SportsHub and book campus courts and grounds in seconds." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { session, refresh } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await signUpFn({
        data: { fullName: fullName.trim(), studentId: studentId.trim(), email: email.trim(), password },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await refresh();
      toast.success("Account created. You're all set to book.");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Something went wrong creating your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-accent-gradient font-display text-sm font-bold text-primary-foreground">
            SH
          </span>
          <h1 className="font-display text-2xl font-semibold">Create your SportsHub account</h1>
          <p className="text-sm text-muted-foreground">Students book courts, grounds and the gym in a few taps.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ananya Sharma" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student">Student ID</Label>
            <Input id="student" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="21CS1043" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">College email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
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
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
