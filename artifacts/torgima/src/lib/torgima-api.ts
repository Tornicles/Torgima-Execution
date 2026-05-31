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
  selected_blueprint_type?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
  projectName?: string;
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

/** POST /api/v1/validations/:id/finalize — lock validation before launch. */
export async function finalizeValidationBlueprint(
  validationId: string,
  selectedPath?: ValidationLaunchDirection["path"],
): Promise<{ finalized: boolean; isFinalized?: boolean }> {
  const envelope = await apiFetchEnvelope<{ finalized: boolean; isFinalized?: boolean }>(
    `/api/v1/validations/${validationId}/finalize`,
    {
      method: "POST",
      body: JSON.stringify({ selectedPath }),
    },
  );
  if (!envelope.ok || !envelope.data?.finalized) {
    throw new Error(formatApiEnvelopeError(envelope, "Could not finalize validation."));
  }
  return envelope.data;
}

/** POST /api/v1/validations/:id/launch — activate blueprint from completed validation. */
export async function launchValidationBlueprint(
  validationId: string,
  selectedDirection: ValidationLaunchDirection,
): Promise<ValidationLaunchResult> {
  const tier =
    selectedDirection.selected_blueprint_type ?? selectedDirection.tier ?? "starter";
  return apiPost<ValidationLaunchResult>(`/api/v1/validations/${validationId}/launch`, {
    validation_id: validationId,
    selected_blueprint_type: tier,
    projectName: selectedDirection.projectName,
    selected_direction: {
      path: selectedDirection.path,
      tier,
      blueprint_type: tier,
      mode: selectedDirection.mode,
    },
  });
}

export async function updateBlueprintProjectName(
  blueprintId: string,
  projectName: string,
): Promise<{ blueprintId: string; projectName: string }> {
  return apiPatch(`/api/blueprints/${blueprintId}/project-name`, { projectName });
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
  error?: {
    message?: string;
    code?: string;
    fieldErrors?: Record<string, string[]>;
    detail?: string;
  };
};

/** User-facing message for onboarding/validation API failures (never map 503 → invalid input). */
export function formatApiEnvelopeError(
  envelope: ApiEnvelope<unknown>,
  fallback = "Request failed.",
): string {
  if (envelope.status === 401) {
    return "Your session expired. Please sign in again.";
  }
  if (envelope.status >= 500) {
    if (envelope.error?.code === "SCHEMA_OUT_OF_DATE") {
      return envelope.error.message ?? "Database schema is out of date.";
    }
    return envelope.error?.message ?? "Server unavailable. Please try again shortly.";
  }
  const fieldErrors = envelope.error?.fieldErrors;
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return Object.entries(fieldErrors)
      .flatMap(([field, msgs]) => msgs.map((m) => `${field}: ${m}`))
      .join(" ");
  }
  return envelope.error?.message ?? fallback;
}

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
      const body = json as {
        ok?: boolean;
        data?: T;
        error?: {
          message?: string;
          code?: string;
          fieldErrors?: Record<string, string[]>;
          details?: string;
        };
      } | null;
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
