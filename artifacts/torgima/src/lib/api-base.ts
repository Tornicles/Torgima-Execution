const fromEnv = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "")
  .trim()
  .replace(/\/+$/, "");

/** Resolved API origin (no trailing slash). Same rules as `@workspace/api-client-react` resolver. */
export const API_BASE_URL =
  !fromEnv && import.meta.env.DEV ? "http://localhost:3001" : fromEnv;

if (import.meta.env.DEV) {
  console.info("[api] using base URL", API_BASE_URL);
}
