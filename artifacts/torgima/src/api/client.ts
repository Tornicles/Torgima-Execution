/**
 * DOC 31 — single fetch wrapper for all frontend API calls.
 * Attaches Supabase Bearer token when available; falls back to session cookie.
 */

import { API_BASE_URL } from "@/lib/api-base";
import { getAuthToken } from "@/lib/auth-token";
import type { ApiRequestOptions, ApiResponse } from "./types";

const AUTH_PUBLIC_PATHS = ["/login", "/verify", "/auth/callback", "/signup", "/landing", "/"];

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function shouldRedirectOn401(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return !AUTH_PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`) || (p === "/" && path === "/"),
  );
}

export function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (!shouldRedirectOn401()) return;
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?returnTo=${returnTo}`;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    method = "GET",
    body,
    headers: extraHeaders,
    idempotencyKey,
    expectedStateVersion,
    signal,
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };

  // Attach Supabase JWT when present (set by useSessionGuard on auth state change)
  const token = getAuthToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body !== undefined && method !== "GET") {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
    headers["x-idempotency-key"] = idempotencyKey;
  }
  if (expectedStateVersion !== undefined) {
    headers["x-expected-state-version"] = String(expectedStateVersion);
  }

  const res = await fetch(resolveUrl(path), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  let envelope: ApiResponse<T>;
  try {
    envelope = (await res.json()) as ApiResponse<T>;
  } catch {
    envelope = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: res.statusText || "Invalid response",
      },
    };
  }

  if (res.status === 401) {
    const sessionExpired =
      envelope.error?.sessionExpired === true ||
      /expired|inactivity/i.test(envelope.error?.message ?? "");
    if (sessionExpired || !envelope.error) {
      envelope.error = {
        code: "UNAUTHENTICATED",
        message: envelope.error?.message ?? "Session expired",
        sessionExpired: true,
        retryable: false,
      };
    }
    // Only redirect when there is no Supabase token — avoids login loops during
    // profile sync or transient backend errors while the user is authenticated.
    if (!getAuthToken()) {
      redirectToLogin();
    }
    return { ...envelope, ok: false };
  }

  if (!res.ok && envelope.ok !== false) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: res.statusText || "Request failed",
      },
    };
  }

  return envelope;
}

export function generateIdempotencyKey(prefix = "mutation"): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
