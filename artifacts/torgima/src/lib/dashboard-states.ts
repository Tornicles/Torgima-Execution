/**
 * DOC 33 — eight dashboard shell states and UI behavior contract.
 */

import type { DashboardUiState } from "@/lib/dashboard-types";
import type { DashboardControlProjection } from "@/types/dashboard";

export type DashboardSystemState =
  | "NORMAL_EXECUTION"
  | "RECOVERY_STATE"
  | "TASK_BLOCKED"
  | "SYSTEM_LOCKED"
  | "FEEDBACK_PENDING"
  | "STALE_STATE"
  | "NO_TASK"
  | "NO_BLUEPRINT";

export function resolveDashboardSystemState(input: {
  uiState: DashboardUiState;
  control: DashboardControlProjection;
  staleActive?: boolean;
}): DashboardSystemState {
  const { uiState, control, staleActive } = input;
  if (uiState === "NO_BLUEPRINT" || !control.blueprintId) return "NO_BLUEPRINT";
  if (staleActive) return "STALE_STATE";
  if (control.locked || uiState === "LOCKED") return "SYSTEM_LOCKED";
  if (uiState === "PENDING_SYNC" || uiState === "AWAITING_FEEDBACK") return "FEEDBACK_PENDING";
  if (control.dependencyAlert || uiState === "BLOCKED") return "TASK_BLOCKED";
  if (uiState === "RECOVERY" || control.recoveryAlert) return "RECOVERY_STATE";
  if (!control.currentAction?.orderId) return "NO_TASK";
  return "NORMAL_EXECUTION";
}

export function mutationsDisabledForState(
  systemState: DashboardSystemState,
  pendingMutation?: boolean,
): boolean {
  if (pendingMutation) return true;
  return (
    systemState === "SYSTEM_LOCKED" ||
    systemState === "STALE_STATE" ||
    systemState === "FEEDBACK_PENDING"
  );
}
