/**
 * Resolved API origin (no trailing slash).
 * Production: Cloudflare Worker URL (override via VITE_API_BASE_URL).
 */
const PRODUCTION_API_BASE_URL = "https://api.torgima.com";

export function getDefaultApiBaseUrl(): string {
  if (import.meta.env.PROD) {
    const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
    const trimmed = raw.trim().replace(/\/+$/, "");
    return trimmed !== "" ? trimmed : PRODUCTION_API_BASE_URL;
  }
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed !== "") {
    return trimmed;
  }
  return "http://localhost:8787";
}
