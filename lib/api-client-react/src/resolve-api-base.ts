/**
 * Resolves the browser-facing API origin for Torgima.
 * - Production: `VITE_API_BASE_URL` must be set (Railway public URL). No hardcoded host.
 * - Development: falls back to local API when the env var is unset.
 */
export function getDefaultApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  const trimmed = typeof v === "string" ? v.trim() : "";
  if (trimmed !== "") {
    return trimmed.replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }
  if (import.meta.env.PROD) {
    console.warn(
      "[api] VITE_API_BASE_URL is not set. Set it in Vercel so the app can reach your Railway API.",
    );
  }
  return "";
}
