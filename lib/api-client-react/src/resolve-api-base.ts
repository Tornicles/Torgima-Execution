/**
 * Resolved API origin (no trailing slash).
 * Production: hardwired Railway URL. Development: localhost or VITE_API_BASE_URL override.
 */
const PRODUCTION_API_BASE_URL =
  "https://workspaceapi-server-production-63b3.up.railway.app";

export function getDefaultApiBaseUrl(): string {
  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE_URL;
  }
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed !== "") {
    return trimmed;
  }
  return "http://localhost:3001";
}
