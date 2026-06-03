/**
 * GAP G7 — typed API access via generated client only.
 */
import { apiFetch } from "@/config/api";
import {
  ApiError,
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
  blueprintTier?: "starter" | "growth" | "ultimate";
  selected_blueprint_type?: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
  projectName?: string;
  blueprintId?: string;
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

/** PATCH /api/blueprints/:id/select-path — persist user's path choice before launch. */
export async function selectBlueprintPath(
  blueprintId: string,
  selectedPath: "current" | "adjusted" | "alternative",
  validationId?: string,
): Promise<{ blueprintId: string; selectedPath: string }> {
  try {
    return await apiPatch(`/api/blueprints/${blueprintId}/select-path`, { selectedPath });
  } catch (err) {
    if (validationId && err instanceof ApiError && err.status === 404) {
      return apiPost(`/api/v1/validation/${validationId}/select-path`, {
        selectedPath,
        path: selectedPath,
        selected_path: selectedPath,
      });
    }
    throw err;
  }
}

export type SelectBlueprintLaunchResult = {
  blueprintId: string;
  validationId: string;
  redirectTo: string;
  redirect_to: string;
  launched: boolean;
  tier: string;
  selectedPath: string;
};

export type TierPreviewCardDto = {
  tier: "starter" | "growth" | "ultimate";
  headline: string;
  description: string;
  planCount: number;
  targetTypes: string[];
  signalSystem: string;
  taskStyle: string;
  aiDepth: string;
  highlights: string[];
  growthProjection: { days30: string; days60: string; days90: string };
  recommended: boolean;
  recommendationReason: string | null;
};

export type SelectTierLaunchResult = {
  blueprintId: string;
  tier: string;
  redirectTo: string;
  launched: boolean;
  generationSummary?: {
    plansCreated: number;
    seasonsCreated: number;
    targetsCreated: number;
    phasesCreated: number;
    actionsCreated: number;
    durationMs: number;
  };
};

/** GET /api/blueprints/:id/tier-preview — saved tier cards after validation. */
export async function fetchTierPreviews(blueprintId: string): Promise<TierPreviewCardDto[]> {
  const res = await apiGet<{ previews?: TierPreviewCardDto[] }>(
    `/api/blueprints/${blueprintId}/tier-preview`,
  );
  return res.previews ?? [];
}

function isRouteNotFound(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 404) return true;
  if (err instanceof Error && /cannot (post|patch|get)\s+\/api\//i.test(err.message)) return true;
  return false;
}

/** DOC 32 — persist tier/mode before launch (no activation). */
export async function configureOnboardingTier(input: {
  blueprintId: string;
  tier: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
}): Promise<void> {
  const body = {
    blueprintId: input.blueprintId,
    tier: input.tier,
    selectedTier: input.tier,
    mode: input.mode ?? "individual",
  };
  const attempts = [
    () => apiPost("/api/onboarding/configure-tier", body),
    () =>
      apiPost(`/api/blueprints/${input.blueprintId}/configure-selection`, {
        tier: input.tier,
        mode: body.mode,
      }),
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (err) {
      lastError = err;
      if (!isRouteNotFound(err)) throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not save tier selection");
}

/** POST launch — tries select-tier, onboarding select-blueprint, then v1 validation launch. */
export async function selectTierAndLaunch(input: {
  blueprintId: string;
  validationId: string;
  selectedTier: "starter" | "growth" | "ultimate";
  selectedPath?: "current" | "adjusted" | "alternative";
}): Promise<SelectTierLaunchResult> {
  const selectedPath = input.selectedPath ?? "adjusted";
  const tierBody = {
    blueprintId: input.blueprintId,
    validationId: input.validationId,
    selectedTier: input.selectedTier,
    selectedPath,
  };
  const onboardingBody = {
    validationId: input.validationId,
    blueprintId: input.blueprintId,
    selectedTier: input.selectedTier,
    blueprintTier: input.selectedTier,
    selectedPath,
  };

  const attempts: Array<() => Promise<SelectTierLaunchResult>> = [
    () => apiPost<SelectTierLaunchResult>("/api/blueprints/select-tier", tierBody),
    () => apiPost<SelectTierLaunchResult>("/api/onboarding/select-blueprint", onboardingBody),
    () => apiPost<SelectTierLaunchResult>("/api/v1/onboarding/select-blueprint", onboardingBody),
    () => apiPost<SelectTierLaunchResult>("/api/onboarding/select-tier", onboardingBody),
    async () => {
      const launched = await launchValidationBlueprint(input.validationId, {
        blueprintId: input.blueprintId,
        path: selectedPath,
        blueprintTier: input.selectedTier,
        tier: input.selectedTier,
      });
      return {
        blueprintId: launched.blueprintId,
        tier: input.selectedTier,
        redirectTo: launched.redirectTo ?? launched.redirect_to ?? "/dashboard",
        launched: launched.launched ?? true,
      };
    },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      if (!isRouteNotFound(err)) throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Blueprint launch failed — API routes unavailable. Redeploy the API server.");
}

/** GET /api/v1/validations/:id/report — PDF validation report (binary). */
export async function downloadValidationReport(
  validationId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiFetch(`/api/v1/validations/${validationId}/report`, {
    method: "GET",
  });
  if (!response.ok) throw new Error("Report generation failed");
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `torgima-validation-report-${validationId}.pdf`;
  return { blob, filename };
}

/** POST /api/v1/validations/:id/launch — activate blueprint from completed validation. */
export async function launchValidationBlueprint(
  validationId: string,
  selectedDirection: ValidationLaunchDirection,
): Promise<ValidationLaunchResult> {
  const tier =
    selectedDirection.blueprintTier ??
    selectedDirection.selected_blueprint_type ??
    selectedDirection.tier ??
    "growth";
  return apiPost<ValidationLaunchResult>(`/api/v1/validations/${validationId}/launch`, {
    validation_id: validationId,
    blueprintId: selectedDirection.blueprintId,
    blueprintTier: tier,
    selectedPath: selectedDirection.path,
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
