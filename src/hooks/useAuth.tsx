import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, student_id").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setProfile(
        p ?? {
          id: userId,
          full_name: session?.user?.email?.split("@")[0] ?? "Student",
          email: session?.user?.email ?? "",
          student_id: null,
        },
      );
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setIsAdmin(false);
      },
    }),
    [session, profile, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
