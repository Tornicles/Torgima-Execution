import { PRODUCTION_BACKEND_URL } from "../config/production.js";
import { resolveAppUrl } from "./app-url.js";

/**
 * Public API origin (Railway) for top-level verify navigation from the SPA callback.
 */
export function resolveApiPublicUrl(): string {
  const override =
    process.env["API_PUBLIC_URL"]?.trim() ||
    process.env["PUBLIC_API_URL"]?.trim() ||
    process.env["VITE_API_BASE_URL"]?.trim();

  if (override) return override.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_BACKEND_URL;
  }

  const port = process.env["PORT"] ?? "3001";
  return `http://localhost:${port}`;
}

/**
 * Link in sign-in emails — always the Vercel SPA callback (APP_URL / FRONTEND_URL).
 * Example: https://torgima.com/auth/callback?token=...&email=...
 */
export function buildMagicLinkVerifyUrl(token: string, email: string): string {
  const base = resolveAppUrl();
  return `${base}/auth/callback?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}