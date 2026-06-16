/**
 * DOC 31 §12 — query keys and invalidation map.
 */

import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";
import type { QueryClient } from "@tanstack/react-query";

export const QUERY_KEYS = {
  dashboardProjection: getGetDashboardStateQueryKey(),
  authSession: ["/api/auth/session"] as const,
  me: ["/api/me"] as const,
  currentOrder: ["/api/orders/current"] as const,
  signals: ["/api/signals/current"] as const,
  outcomes: ["/api/outcomes/current"] as const,
} as const;

export type StateChangeEvent =
  | "state_changed"
  | "order_available"
  | "feedback_submitted"
  | "condition_evaluated"
  | "reward_created"
  | "identity_updated"
  | "outcome_validated"
  | "system_health_degraded"
  | "dependency_resolved";

const INVALIDATION_MAP: Record<StateChangeEvent, readonly (readonly string[])[]> = {
  state_changed: [QUERY_KEYS.dashboardProjection, QUERY_KEYS.currentOrder],
  order_available: [QUERY_KEYS.dashboardProjection, QUERY_KEYS.currentOrder],
  feedback_submitted: [
    QUERY_KEYS.dashboardProjection,
    QUERY_KEYS.currentOrder,
    QUERY_KEYS.signals,
  ],
  condition_evaluated: [QUERY_KEYS.dashboardProjection, QUERY_KEYS.signals],
  reward_created: [QUERY_KEYS.dashboardProjection],
  identity_updated: [QUERY_KEYS.dashboardProjection],
  outcome_validated: [QUERY_KEYS.dashboardProjection, QUERY_KEYS.outcomes],
  system_health_degraded: [QUERY_KEYS.dashboardProjection],
  dependency_resolved: [QUERY_KEYS.dashboardProjection, QUERY_KEYS.currentOrder],
};

export async function invalidateByEvent(
  queryClient: QueryClient,
  event: StateChangeEvent,
): Promise<void> {
  const keys = INVALIDATION_MAP[event] ?? [QUERY_KEYS.dashboardProjection];
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  );
}

export async function invalidateDashboardProjection(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardProjection });
}

/** DOC 31 — after feedback submission. */
export async function invalidateAfterFeedback(queryClient: QueryClient): Promise<void> {
  await invalidateByEvent(queryClient, "feedback_submitted");
}

/** DOC 31 — after outcome evidence submission. */
export async function invalidateAfterOutcome(queryClient: QueryClient): Promise<void> {
  await invalidateByEvent(queryClient, "outcome_validated");
}

/** DOC 31 — after order start. */
export async function invalidateAfterOrderStart(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.currentOrder }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboardProjection }),
  ]);
}
