import { getDefaultApiBaseUrl } from "@workspace/api-client-react";

/** Resolved API origin (no trailing slash). Raw `fetch` helpers use this string. */
export const API_BASE_URL = getDefaultApiBaseUrl();

if (import.meta.env.DEV) {
  console.info("[api] using base URL", API_BASE_URL);
}
