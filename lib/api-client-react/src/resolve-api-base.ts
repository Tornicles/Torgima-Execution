/**
 * Resolved API origin (no trailing slash).
 * Production: require `VITE_API_BASE_URL` (Railway). Development: localhost API when unset.
 */
export function getDefaultApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed !== "") {
    return trimmed;
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
