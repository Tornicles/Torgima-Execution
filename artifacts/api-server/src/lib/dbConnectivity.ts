/**
 * Detect Postgres connectivity failures (Worker → Supabase pooler unreachable, etc.).
 */

const CONNECTIVITY_PATTERNS = [
  /timed?\s*out/i,
  /timeout/i,
  /etimedout/i,
  /econnrefused/i,
  /connection refused/i,
  /network is unreachable/i,
  /enotfound/i,
  /getaddrinfo/i,
  /connect econn/i,
  /could not connect/i,
  /connection terminated/i,
  /failed to connect/i,
];

export function isDbConnectivityError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  if (CONNECTIVITY_PATTERNS.some((p) => p.test(message))) return true;

  const cause = err instanceof Error && "cause" in err ? (err as Error & { cause?: unknown }).cause : null;
  if (cause) return isDbConnectivityError(cause);

  return false;
}
