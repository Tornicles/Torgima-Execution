/**
 * Browser-side Supabase client — uses the anon/public key.
 * Safe to ship to the browser.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in Cloudflare Pages env vars",
  );
}

export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "torgima-auth-token",
    flowType: "pkce",
  },
});

/** Returns the current session's access token (Supabase JWT), or null if not signed in. */
export async function getSupabaseToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
