import { PRODUCTION_FRONTEND_URL } from "../config/production.js";

/**
 * Canonical browser origin for links in emails (magic link, notifications).
 * DOC 30: production links must use APP_URL only (never Replit/localhost/hardcoded fallback when set).
 */
export function resolveAppUrl(): string {
  const appUrl = process.env["APP_URL"]?.trim().replace(/\/$/, "");
  if (appUrl) return appUrl;

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_FRONTEND_URL;
  }

  const frontend = process.env["FRONTEND_URL"]?.split(",")[0]?.trim();
  const candidates = [
    frontend,
    process.env["PUBLIC_APP_URL"],
    process.env["NEXT_PUBLIC_APP_URL"],
  ].filter((v): v is string => Boolean(v && v.trim()));

  return (candidates[0] ?? "http://localhost:5173").replace(/\/$/, "");
}
