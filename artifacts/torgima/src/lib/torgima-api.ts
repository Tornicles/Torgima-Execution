/**
 * GAP G7 — typed API access via generated client only.
 */
import { apiFetch } from "@/config/api";
import {
  customFetch,
  getOrder,
  getExecutionActiveOrder,
  submitExecutionFeedback,
  submitOrderFeedback,
  answerFeedbackInterrogation,
  getCurrentSignals,
  getSignalHistory,
  getCurrentCondition,
  getDashboardState,
  getMe,
  startOrder,
  blockOrder,
  getAuthSession,
  sendMagicLink,
  completeOnboarding,
  structureGoal,
  requestExecutionHelp,
  getGetDashboardStateQueryKey,
} from "@workspace/api-client-react";

export {
  customFetch,
  getOrder,
  getExecutionActiveOrder,
  submitExecutionFeedback,
  submitOrderFeedback,
  answerFeedbackInterrogation,
  getCurrentSignals,
  getSignalHistory,
  getCurrentCondition,
  getDashboardState,
  getMe,
  startOrder,
  blockOrder,
  getAuthSession,
  sendMagicLink,
  completeOnboarding,
  structureGoal,
  requestExecutionHelp,
  getGetDashboardStateQueryKey,
};

export type ValidationLaunchDirection = {
  path: "current" | "adjusted" | "alternative";
  tier?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
};

export type ValidationLaunchResult = {
  success: boolean;
  blueprint: { id: string };
  blueprintId: string;
  validationId: string;
  redirectTo: string;
  redirect_to: string;
  launched: boolean;
  idempotent?: boolean;
};

/** POST /api/v1/validations/:id/launch — activate blueprint from completed validation. */
export async function launchValidationBlueprint(
  validationId: string,
  selectedDirection: ValidationLaunchDirection,
): Promise<ValidationLaunchResult> {
  return apiPost<ValidationLaunchResult>(`/api/v1/validations/${validationId}/launch`, {
    selected_direction: selectedDirection,
  });
}

/** POST helper for routes not yet in OpenAPI — still uses customFetch (not raw fetch). */
export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  return customFetch<T>(path, { method: "GET" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry wrapper for generated client calls (replaces raw fetch to /api). */
export async function apiFetchWithRetry<T = unknown>(
  path: string,
  init?: RequestInit,
  attempts = 3,
): Promise<T> {
  const apiPath = path.includes("/api/") ? path.slice(path.indexOf("/api/")) : path.startsWith("/") ? path : `/api${path}`;
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await customFetch<T>(apiPath, init);
    } catch (err) {
      last = err;
      if (attempt === attempts - 1) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw last instanceof Error ? last : new Error("Request failed");
}

export type ApiEnvelope<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: { message?: string; code?: string };
};

function normalizeApiPath(pathOrUrl: string): string {
  if (pathOrUrl.includes("/api/")) return pathOrUrl.slice(pathOrUrl.indexOf("/api/"));
  return pathOrUrl.startsWith("/") ? pathOrUrl : `/api${pathOrUrl}`;
}

/** Parses real HTTP + `{ ok, data, error }` envelope (does not mask failures). */
export async function apiFetchEnvelope<T = unknown>(
  pathOrUrl: string,
  init?: RequestInit,
  attempts = 3,
): Promise<ApiEnvelope<T>> {
  const apiPath = normalizeApiPath(pathOrUrl);
  let last: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await apiFetch(apiPath, init);
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      const body = json as { ok?: boolean; data?: T; error?: { message?: string; code?: string } } | null;
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: body?.error ?? { message: res.statusText || `HTTP ${res.status}` },
        };
      }
      if (body && typeof body === "object" && "ok" in body) {
        return {
          ok: body.ok === true,
          status: res.status,
          data: body.data,
          error: body.error,
        };
      }
      return { ok: true, status: res.status, data: json as T };
    } catch (err) {
      last = err;
      if (attempt === attempts - 1) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  const message = last instanceof Error ? last.message : "Request failed";
  return { ok: false, status: 0, error: { message } };
}

/** Compatibility shim: returns Response mirroring the API envelope. */
export async function apiFetchResponseWithRetry(
  pathOrUrl: string,
  init?: RequestInit,
  attempts = 3,
): Promise<Response> {
  const result = await apiFetchEnvelope<unknown>(pathOrUrl, init, attempts);
  return new Response(JSON.stringify({ ok: result.ok, data: result.data, error: result.error }), {
    status: result.status || (result.ok ? 200 : 500),
    headers: { "Content-Type": "application/json" },
  });
}
