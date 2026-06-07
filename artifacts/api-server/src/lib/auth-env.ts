/**
 * DOC 30 — required auth environment variables (production boot gate).
 */

const FORBIDDEN_APP_URL_SUBSTRINGS = ["replit", "localhost", "127.0.0.1"] as const;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function resolveRequiredAppUrl(): string {
  const raw =
    process.env.APP_URL ??
    process.env.FRONTEND_URL?.split(",")[0]?.trim() ??
    process.env.PUBLIC_APP_URL ??
    "";

  if (!raw.trim()) {
    throw new Error(
      "Missing env: APP_URL (must be your production frontend origin, e.g. https://torgima.com — no trailing slash)",
    );
  }

  const url = normalizeUrl(raw);
  const lower = url.toLowerCase();
  for (const bad of FORBIDDEN_APP_URL_SUBSTRINGS) {
    if (lower.includes(bad)) {
      throw new Error(`APP_URL must not point to ${bad}; set APP_URL to https://torgima.com (Cloudflare Pages)`);
    }
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("APP_URL must start with http:// or https://");
  }

  return url;
}

/** Fail fast in production when auth-critical env is missing or unsafe. */
export function assertAuthEnvOnBoot(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["DATABASE_URL", "INTERNAL_API_SECRET", "APP_URL"] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Missing required env: ${key}`);
    }
  }

  resolveRequiredAppUrl();

  const sessionSecret = process.env.NEXTAUTH_SECRET ?? process.env.SESSION_SECRET;
  if (!sessionSecret?.trim() || sessionSecret.trim().length < 32) {
    throw new Error("Missing required env: NEXTAUTH_SECRET (minimum 32 characters)");
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("Missing required env: RESEND_API_KEY");
  }
}
