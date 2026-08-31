import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getMeFn, signOutFn, type AuthUser } from "@/lib/auth.server";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  student_id: string | null;
}

/** Minimal session shape kept for compatibility with existing consumers. */
interface SessionLike {
  user: { id: string; email: string };
}

interface AuthState {
  session: SessionLike | null;
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function toState(me: AuthUser | null): {
  session: SessionLike | null;
  profile: Profile | null;
  isAdmin: boolean;
} {
  if (!me) return { session: null, profile: null, isAdmin: false };
  return {
    session: { user: { id: me.id, email: me.email } },
    profile: { id: me.id, full_name: me.full_name, email: me.email, student_id: me.student_id },
    isAdmin: me.isAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await getMeFn();
      setMe(next);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthState>(() => {
    const { session, profile, isAdmin } = toState(me);
    return {
      session,
      user: session?.user ?? null,
      profile,
      isAdmin,
      loading,
      refresh,
      signOut: async () => {
        await signOutFn();
        setMe(null);
      },
    };
  }, [me, loading, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
