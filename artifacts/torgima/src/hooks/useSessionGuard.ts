/**
 * Session guard — subscribes to Supabase auth state, fetches the TORGIMA
 * profile from /api/auth/session, and redirects unauthenticated users to /login.
 *
 * Also injects the Supabase JWT into the API client token store so every
 * API call automatically carries the Authorization: Bearer header.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/auth-token";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useSessionStore } from "@/store/sessionStore";
import { apiFetch } from "@/config/api";

// Wire the generated API client to use Supabase token once on module load.
// customFetch picks this up before every request.
setAuthTokenGetter(async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
});

async function fetchTorgimaProfile(accessToken: string): Promise<{
  userId: string;
  sessionId: string;
  userMode: string;
  userTier: string;
} | null> {
  try {
    // apiFetch injects the auth token from auth-token store automatically.
    // We also set the token manually here so it's available before the store updates.
    setAuthToken(accessToken);
    const res = await apiFetch("/api/auth/session");
    if (!res.ok) return null;
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        authenticated?: boolean;
        userId?: string;
        sessionId?: string;
        userMode?: string;
        userTier?: string;
      };
    };
    const data = body?.data;
    if (!data?.authenticated || !data.userId) return null;
    return {
      userId: data.userId,
      sessionId: data.sessionId ?? "supabase-jwt",
      userMode: data.userMode ?? "individual",
      userTier: data.userTier ?? "starter",
    };
  } catch {
    return null;
  }
}

export function useSessionGuard() {
  const [, setLocation] = useLocation();
  const userId = useSessionStore((s) => s.userId);
  const loaded = useSessionStore((s) => s.loaded);
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setAuthToken(null);
        clearSession();
        setLocation("/login");
        return;
      }

      setAuthToken(session.access_token);

      const profile = await fetchTorgimaProfile(session.access_token);
      if (cancelled) return;

      if (!profile) {
        clearSession();
        setLocation("/login");
        return;
      }

      setSession(profile);
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (!session?.access_token) {
        setAuthToken(null);
        clearSession();
        if (event === "SIGNED_OUT") {
          setLocation("/login");
        }
        return;
      }

      setAuthToken(session.access_token);

      const profile = await fetchTorgimaProfile(session.access_token);
      if (cancelled) return;

      if (profile) {
        setSession(profile);
      } else {
        clearSession();
        setLocation("/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setSession, clearSession, setLocation]);

  return { userId, loaded, authenticated: Boolean(userId) };
}
