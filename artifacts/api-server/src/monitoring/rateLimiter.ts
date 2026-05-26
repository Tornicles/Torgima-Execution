/**
 * In-memory rate limiter (Prompt 37). Optional REDIS_URL reserved for future Upstash wiring.
 * Fails open when disabled or on internal errors.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

function pruneExpired(now: number): void {
  if (windows.size < 5000) return;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export function isRateLimitingEnabled(): boolean {
  return process.env.ENABLE_RATE_LIMITING !== "false";
}

export function getRateLimitConfig(): { limit: number; windowMs: number } {
  return {
    limit: parseInt(process.env.RATE_LIMIT_REQUESTS ?? "100", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  };
}

export async function checkRateLimit(
  key: string,
  limit?: number,
  windowMs?: number,
): Promise<boolean> {
  if (!isRateLimitingEnabled()) return true;

  const cfg = getRateLimitConfig();
  const max = limit ?? cfg.limit;
  const window = windowMs ?? cfg.windowMs;
  const now = Date.now();

  pruneExpired(now);

  let state = windows.get(key);
  if (!state || state.resetAt <= now) {
    state = { count: 0, resetAt: now + window };
    windows.set(key, state);
  }

  state.count += 1;
  return state.count <= max;
}

export function resetRateLimit(key: string): void {
  windows.delete(key);
}
