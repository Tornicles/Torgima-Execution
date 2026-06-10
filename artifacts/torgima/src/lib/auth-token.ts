/**
 * Module-level token store — holds the current Supabase JWT so the API
 * client can attach it synchronously without an extra async getSession() call.
 *
 * Updated by useSessionGuard whenever the Supabase auth state changes.
 */

let _token: string | null = null;

export function setAuthToken(token: string | null): void {
  _token = token;
}

export function getAuthToken(): string | null {
  return _token;
}
