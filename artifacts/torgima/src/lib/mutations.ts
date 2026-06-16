/**
 * DOC 31 §6 — mutation helpers: state version, idempotency, invalidate on success.
 */

import type { QueryClient } from "@tanstack/react-query";
import { apiRequest, generateIdempotencyKey, redirectToLogin } from "@/api/client";
import type { ApiResponse } from "@/api/types";
import { getDashboardStateVersion, useDashboardStore } from "@/store/dashboardStore";
import { invalidateDashboardProjection, invalidateAfterFeedback } from "@/lib/query-keys";
import { isStaleStateConflict } from "@/lib/stale-state-retry";
import { handleStaleStateConflict } from "@/lib/state-version";

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> };

function toMutationResult<T>(res: ApiResponse<T>): MutationResult<T> {
  if (res.ok && res.data !== undefined) {
    return { ok: true, data: res.data };
  }
  return {
    ok: false,
    code: res.error?.code ?? "INTERNAL_ERROR",
    message: res.error?.message ?? "Request failed",
    fieldErrors: res.error?.fieldErrors,
  };
}

/**
 * Standard mutation flow: call API → invalidate dashboard on success → handle stale/auth.
 */
export async function runDashboardMutation<T>(
  queryClient: QueryClient,
  call: (stateVersion: number, idempotencyKey: string) => Promise<ApiResponse<T>>,
  options?: { idempotencyPrefix?: string; skipInvalidate?: boolean },
): Promise<MutationResult<T>> {
  const stateVersion = getDashboardStateVersion();
  const idempotencyKey = generateIdempotencyKey(options?.idempotencyPrefix ?? "mutation");

  const res = await call(stateVersion, idempotencyKey);

  if (res.error?.code === "UNAUTHENTICATED") {
    useDashboardStore.getState().setProjection(null);
    redirectToLogin();
    return toMutationResult(res);
  }

  if (res.error?.code === "STALE_STATE") {
    await handleStaleStateConflict(queryClient);
    return {
      ok: false,
      code: "STALE_STATE",
      message: "State refreshed — please try again",
    };
  }

  if (res.ok) {
    if (!options?.skipInvalidate) {
      useDashboardStore.getState().invalidate();
      await invalidateAfterFeedback(queryClient);
    }
    return toMutationResult(res);
  }

  return toMutationResult(res);
}

/** Bridge for legacy ApiError-based mutations. */
export async function afterMutationSuccess(queryClient: QueryClient): Promise<void> {
  useDashboardStore.getState().invalidate();
  await invalidateDashboardProjection(queryClient);
}

export async function onMutationError(
  queryClient: QueryClient,
  err: unknown,
): Promise<"stale" | "auth" | "other"> {
  if (isStaleStateConflict(err)) {
    await handleStaleStateConflict(queryClient);
    return "stale";
  }
  const code =
    err &&
    typeof err === "object" &&
    "data" in err &&
    (err as { data?: { error?: { code?: string } } }).data?.error?.code;
  if (code === "UNAUTHENTICATED") {
    redirectToLogin();
    return "auth";
  }
  return "other";
}
