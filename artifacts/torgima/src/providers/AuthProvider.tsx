/**
 * Central Supabase auth state — single source of truth for session persistence.
 *
 * Initializes from supabase.auth.getSession(), subscribes to onAuthStateChange,
 * and syncs the access token into the API client token store.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/auth-token";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { apiFetch } from "@/config/api";
import { useSessionStore } from "@/store/sessionStore";

export type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** Re-fetch TORGIMA profile from /api/auth/session */
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function setFallbackSession(supabaseUserId: string): void {
  useSessionStore.getState().setSession({
    userId: supabaseUserId,
    sessionId: "supabase-jwt",
    userMode: "individual",
    userTier: "starter",
  });
}

async function syncTorgimaProfile(
  accessToken: string,
  supabaseUserId?: string,
): Promise<boolean> {
  setAuthToken(accessToken);
  try {
    const res = await apiFetch("/api/auth/session");
    if (!res.ok) {
      if (supabaseUserId) setFallbackSession(supabaseUserId);
      return false;
    }
    const body = (await res.json()) as {
      data?: {
        authenticated?: boolean;
        userId?: string;
        sessionId?: string;
        userMode?: string;
        userTier?: string;
      };
    };
    const data = body?.data;
    if (!data?.authenticated || !data.userId) {
      if (supabaseUserId) setFallbackSession(supabaseUserId);
      return false;
    }
    useSessionStore.getState().setSession({
      userId: data.userId,
      sessionId: data.sessionId ?? "supabase-jwt",
      userMode: data.userMode ?? "individual",
      userTier: data.userTier ?? "starter",
    });
    return true;
  } catch {
    if (supabaseUserId) setFallbackSession(supabaseUserId);
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const clearSessionStore = useSessionStore((s) => s.clearSession);

  const refreshProfile = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      clearSessionStore();
      return;
    }
    await syncTorgimaProfile(token, user?.id);
  }, [session?.access_token, user?.id, clearSessionStore]);

  useEffect(() => {
    // Wire generated API client to read token from Supabase on every request.
    setAuthTokenGetter(async () => {
      const {
        data: { session: current },
      } = await supabase.auth.getSession();
      return current?.access_token ?? null;
    });

    let cancelled = false;

    async function init() {
      const {
        data: { session: initial },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      setSession(initial);
      setUser(initial?.user ?? null);

      if (initial?.access_token) {
        setAuthToken(initial.access_token);
        await syncTorgimaProfile(initial.access_token, initial.user?.id);
      } else {
        setAuthToken(null);
        clearSessionStore();
      }

      setLoading(false);
    }

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.access_token) {
        setAuthToken(nextSession.access_token);
        await syncTorgimaProfile(nextSession.access_token, nextSession.user?.id);
      } else {
        setAuthToken(null);
        clearSessionStore();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [clearSessionStore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user,
      accessToken: session?.access_token ?? null,
      isAuthenticated: Boolean(session?.access_token),
      refreshProfile,
    }),
    [loading, session, user, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
