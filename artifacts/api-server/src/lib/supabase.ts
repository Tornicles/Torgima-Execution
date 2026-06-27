/**
 * Server-side Supabase client — uses the service_role key.
 * Has full database access. Never exposed to the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseRestBaseUrl } from "./databaseTargetDebug.js";

let _adminClient: SupabaseClient | null = null;

function getSupabaseEnv(): { url: string; serviceRoleKey: string } {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const resolved = resolveSupabaseRestBaseUrl(
    process.env.SUPABASE_URL,
    process.env.DATABASE_URL,
  );
  const url = resolved?.url ?? process.env.SUPABASE_URL?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "[Supabase] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Cloudflare secrets",
    );
  }
  return { url, serviceRoleKey };
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_adminClient) return _adminClient;
  const { url, serviceRoleKey } = getSupabaseEnv();
  _adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return _adminClient;
}

export interface SupabaseVerifiedUser {
  userId: string;
  email: string;
}

/**
 * Verify a Supabase JWT by calling the Supabase Auth API.
 * Returns the userId (auth.users.id) and email on success, null on failure.
 *
 * NOTE: This is a network call to Supabase Auth. It works even when your
 * PostgreSQL database is restricted, since Auth is a separate service.
 */
export async function verifySupabaseJwt(
  token: string,
): Promise<SupabaseVerifiedUser | null> {
  try {
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return { userId: user.id, email: user.email ?? "" };
  } catch {
    return null;
  }
}
