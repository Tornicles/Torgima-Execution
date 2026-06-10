/**
 * Browser-side Supabase client — uses the anon/public key.
 * Safe to ship to the browser.
 *
 * When env vars are absent (CI build, static preview) we fall back to a
 * placeholder URL so createClient never throws.  The client will be
 * non-functional (all auth calls will fail gracefully) but the app module
 * graph initialises cleanly and unauthenticated redirects still work.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isConfigured) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — " +
      "auth is disabled in this environment (session will always be null).",
  );
}

export const supabase = createClient(
  SUPABASE_URL || "https://placeholder.supabase.co",
  SUPABASE_ANON_KEY || "placeholder-anon-key",
  {
    auth: {
      // Disable all I/O when we have no real credentials so tests don't hang
      // waiting for network calls to a placeholder host.
      autoRefreshToken: isConfigured,
      persistSession: isConfigured,
      detectSessionInUrl: isConfigured,
      storageKey: "torgima-auth-token",
      flowType: "pkce",
    },
  },
);

/** Returns the current session's access token (Supabase JWT), or null if not signed in. */
export async function getSupabaseToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
