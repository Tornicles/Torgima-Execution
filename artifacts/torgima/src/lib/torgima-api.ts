/**
 * GAP G7 — typed API access via generated client only.
 */
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

/** Compatibility shim: returns Response with `{ ok, data }` envelope for legacy callers. */
export async function apiFetchResponseWithRetry(
  pathOrUrl: string,
  init?: RequestInit,
  attempts = 3,
): Promise<Response> {
  const apiPath = pathOrUrl.includes("/api/") ? pathOrUrl.slice(pathOrUrl.indexOf("/api/")) : pathOrUrl;
  const data = await apiFetchWithRetry<unknown>(apiPath, init, attempts);
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
