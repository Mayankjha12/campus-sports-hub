import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Navbar } from "@/components/navbar/Navbar";
import { LoadingState } from "@/components/shared/states";
import { useAuth } from "@/hooks/useAuth";

export function AppShell({ children, adminOnly = false, publicAccess = false }: { children: ReactNode; adminOnly?: boolean; publicAccess?: boolean }) {
  const { session, loading, isAdmin, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && adminOnly && profile && !isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, session, adminOnly, isAdmin, profile, navigate]);

  if (adminOnly && (loading || !session)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-24">
        <LoadingState label="Checking your session..." />
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <>
        <Navbar />
        <div className="mx-auto w-full max-w-3xl px-4 py-24">
          <LoadingState label="Verifying admin access..." />
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        SportsHub · Campus Sports Facility Booking · Book your game. Own your time.
      </footer>
    </div>
  );
}
