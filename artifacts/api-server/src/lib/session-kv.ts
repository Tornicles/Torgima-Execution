/**
 * KV session infrastructure (Cloudflare). Used when SESSIONS binding is present.
 */

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

function kv(): KVNamespace {
  const binding = globalThis.__TORGIMA_SESSIONS_KV__;
  if (!binding) {
    throw new Error("[SessionKV] SESSIONS KV binding is not configured");
  }
  return binding;
}

export function kvSessionsEnabled(): boolean {
  return process.env.TORGIMA_KV_SESSIONS === "true" && Boolean(globalThis.__TORGIMA_SESSIONS_KV__);
}

export async function kvCreateSession(userId: string, token: string): Promise<void> {
  await kv().put(
    `${SESSION_PREFIX}${token}`,
    JSON.stringify({ userId, createdAt: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS },
  );
}

export async function kvGetSession(token: string): Promise<{ userId: string } | null> {
  const raw = await kv().get(`${SESSION_PREFIX}${token}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: string };
    return parsed.userId ? { userId: parsed.userId } : null;
  } catch {
    return null;
  }
}

export async function kvDeleteSession(token: string): Promise<void> {
  await kv().delete(`${SESSION_PREFIX}${token}`);
}
