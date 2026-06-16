import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";

const dashboardCache = new Map<string, { value: unknown; expiresAt: number }>();

function dashboardCacheTtlMs(): number {
  const raw = process.env.DASHBOARD_CACHE_TTL_MS;
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  return isCloudflareRuntime() ? 5_000 : 0;
}

export function getCachedDashboard<T>(userId: string): T | undefined {
  if (dashboardCacheTtlMs() <= 0) return undefined;
  const hit = dashboardCache.get(userId);
  if (hit && Date.now() < hit.expiresAt) return hit.value as T;
  if (hit) dashboardCache.delete(userId);
  return undefined;
}

export function setCachedDashboard(userId: string, value: unknown): void {
  const ttl = dashboardCacheTtlMs();
  if (ttl <= 0) return;
  dashboardCache.set(userId, { value, expiresAt: Date.now() + ttl });
  if (dashboardCache.size > 5_000) {
    const now = Date.now();
    for (const [key, entry] of dashboardCache) {
      if (now >= entry.expiresAt) dashboardCache.delete(key);
    }
  }
}

/** Clears a user's cached dashboard projection after a state-changing mutation. */
export function invalidateDashboardCache(userId: string): void {
  dashboardCache.delete(userId);
}
