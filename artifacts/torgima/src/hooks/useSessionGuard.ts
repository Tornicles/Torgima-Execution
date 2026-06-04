/**
 * DOC 31 §4 — session guard for protected screens.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { fetchAuthSession } from "@/api/auth";
import { useSessionStore } from "@/store/sessionStore";

export function useSessionGuard() {
  const [, setLocation] = useLocation();
  const userId = useSessionStore((s) => s.userId);
  const loaded = useSessionStore((s) => s.loaded);
  const setSession = useSessionStore((s) => s.setSession);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    if (loaded) return;

    void fetchAuthSession()
      .then((res) => {
        if (!res.ok || !res.data?.authenticated || !res.data.userId) {
          clearSession();
          setLocation("/login");
          return;
        }
        setSession({
          userId: res.data.userId,
          sessionId: res.data.sessionId ?? "",
          userMode: res.data.userMode ?? "individual",
          userTier: res.data.userTier ?? "starter",
        });
      })
      .catch(() => {
        clearSession();
        setLocation("/login");
      });
  }, [loaded, setSession, clearSession, setLocation]);

  return { userId, loaded, authenticated: Boolean(userId) };
}
