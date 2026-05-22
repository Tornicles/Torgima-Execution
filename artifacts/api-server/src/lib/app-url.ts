/**
 * Canonical browser origin for links in emails (magic link, notifications).
 * FRONTEND_URL is preferred because it matches CORS and where users open the SPA.
 */
export function resolveAppUrl(): string {
  const frontend = process.env["FRONTEND_URL"]?.split(",")[0]?.trim();
  const candidates = [
    frontend,
    process.env["APP_URL"],
    process.env["PUBLIC_APP_URL"],
    process.env["NEXT_PUBLIC_APP_URL"],
  ].filter((v): v is string => Boolean(v && v.trim()));

  return (candidates[0] ?? "http://localhost:5173").replace(/\/$/, "");
}
