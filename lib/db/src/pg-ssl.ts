/**
 * Remove sslmode from the URL so node-postgres/pg does not override Pool.ssl
 * (pg v8 treats sslmode=require as verify-full and breaks Supabase on some hosts).
 */
export function stripSslModeFromConnectionString(connectionString: string): string {
  try {
    const normalized = connectionString.replace(/^postgresql:/i, "postgres:");
    const u = new URL(normalized);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    const out = u.toString();
    return out.replace(/^postgres:/i, "postgresql:");
  } catch {
    return connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, "");
  }
}

/**
 * Configure node-postgres TLS for hosted Postgres (Railway, Supabase, Neon, …).
 * Local/docker sockets stay off TLS unless sslmode=require is present.
 */
export function resolvePgSsl(connectionString: string): boolean | { rejectUnauthorized: boolean } {
  const lower = connectionString.toLowerCase();

  if (lower.includes("sslmode=disable")) return false;

  if (/unix\s*:/i.test(connectionString)) return false;

  const hostMatch = connectionString.match(/@([^/:?]+)/);
  const host = hostMatch?.[1]?.toLowerCase() ?? "";

  if (!host) return false;

  const requiresSslMode =
    lower.includes("sslmode=require") ||
    lower.includes("sslmode=no-verify") ||
    lower.includes("sslmode=verify-full");

  const localLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  const internalKubernetes =
    host.endsWith(".railway.internal") ||
    host.endsWith(".svc.cluster.local");

  /** Typical compose service name (`postgres`, `db`) — no TLS inside the bridge network. */
  const plainServiceName = !host.includes(".");

  if (
    (localLoopback || internalKubernetes || plainServiceName) &&
    !requiresSslMode
  ) {
    return false;
  }

  const hostedPatterns =
    requiresSslMode ||
    lower.includes("supabase") ||
    lower.includes("neon.tech") ||
    lower.includes(".railway.app") ||
    lower.includes("render.com") ||
    lower.includes(".fly.dev") ||
    lower.includes("cockroachlabs.cloud") ||
    lower.includes(".azure.") ||
    lower.includes("cloudsql") ||
    lower.includes("rds.amazonaws.com") ||
    lower.includes("postgres.database.azure") ||
    lower.includes("digitalocean.com");

  if (hostedPatterns || host.includes(".")) {
    return { rejectUnauthorized: false };
  }

  return false;
}
