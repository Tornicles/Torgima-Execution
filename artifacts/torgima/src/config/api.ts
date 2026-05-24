/**
 * Hardwired API origin for production (Vercel → Railway).
 * Development still uses localhost:3001.
 */
const PRODUCTION_API_BASE_URL =
  "https://workspaceapi-server-production-63b3.up.railway.app";

export const API_BASE_URL = import.meta.env.DEV
  ? "http://localhost:3001"
  : PRODUCTION_API_BASE_URL;

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);
  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    credentials: "include",
    headers,
  });
}
