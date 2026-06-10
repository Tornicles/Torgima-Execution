/**
 * API origin — Cloudflare Worker in production (override via VITE_API_BASE_URL).
 * Empty string = same-origin /api (Pages service binding proxy).
 */
import { getAuthToken } from "@/lib/auth-token";
const DEFAULT_CLOUDFLARE_API_URL = "https://api.torgima.com";

function resolveProductionApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string") return fromEnv.trim().replace(/\/$/, "");
  return DEFAULT_CLOUDFLARE_API_URL;
}

export const API_BASE_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") || "http://localhost:8787")
  : resolveProductionApiBase();

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options.headers);
  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    credentials: "include",
    headers,
  });
}
