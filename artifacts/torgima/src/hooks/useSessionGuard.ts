/**
 * Session guard for protected routes.
 *
 * Waits for AuthProvider to finish initializing before making redirect decisions.
 * Only redirects to /login when loading=false AND no Supabase session exists.
 * Does NOT redirect when Supabase session exists but TORGIMA profile sync is pending.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/providers/AuthProvider";
import { useSessionStore } from "@/store/sessionStore";

export function useSessionGuard() {
  const [, setLocation] = useLocation();
  const { loading, isAuthenticated, refreshProfile } = useAuth();
  const userId = useSessionStore((s) => s.userId);
  const storeLoaded = useSessionStore((s) => s.loaded);

  // Retry profile sync once when Supabase session exists but store is empty.
  useEffect(() => {
    if (loading || !isAuthenticated || userId) return;
    void refreshProfile();
  }, [loading, isAuthenticated, userId, refreshProfile]);

  // Redirect only after auth initialization completes with no session.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Wait for profile sync when Supabase session exists; skip wait when unauthenticated.
  const loaded = !loading && (!isAuthenticated || storeLoaded);
  const authenticated = isAuthenticated;

  return { userId, loaded, authenticated };
}
