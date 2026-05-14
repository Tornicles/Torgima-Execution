/** Canonical API origin for manual `fetch` calls (session guard, login). Mirrors `main.tsx` + `customFetch`. */
export const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()?.replace(/\/+$/, "") ??
  "http://localhost:3001"
);
