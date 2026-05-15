export type DashboardUiState =
  | "NO_BLUEPRINT"
  | "READY"
  | "IN_PROGRESS"
  | "AWAITING_FEEDBACK"
  | "BLOCKED"
  | "RECOVERY"
  | "LOCKED"
  | "PENDING_SYNC"
  | "ERROR";

export interface DashboardAlert {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

export function deriveDashboardUiState(params: {
  hasBlueprint: boolean;
  blueprintStatus?: string | null;
  systemOperational: boolean;
  condition?: string | null;
  recoveryRequired?: boolean;
  currentActionStatus?: string | null;
  currentActionTaskType?: string | null;
  hasAwaitingFeedbackOrder: boolean;
  hasBlockedOrder: boolean;
  hasPendingOrActiveTask: boolean;
}): DashboardUiState {
  if (!params.hasBlueprint) return "NO_BLUEPRINT";
  if (!params.systemOperational) return "LOCKED";

  if (params.hasAwaitingFeedbackOrder) return "AWAITING_FEEDBACK";

  if (params.hasBlockedOrder && !params.hasPendingOrActiveTask) return "BLOCKED";

  const cond = (params.condition ?? "").toLowerCase();
  const recoveryTask =
    params.currentActionTaskType === "recovery" ||
    params.currentActionTaskType === "blocker_resolution";
  if (
    params.recoveryRequired ||
    recoveryTask ||
    (cond === "danger" && !params.hasPendingOrActiveTask)
  ) {
    return "RECOVERY";
  }

  if (params.currentActionStatus === "active") return "IN_PROGRESS";
  if (params.currentActionStatus === "pending") return "READY";

  if (params.hasBlueprint && params.blueprintStatus === "active" && !params.hasPendingOrActiveTask) {
    return "PENDING_SYNC";
  }

  return "READY";
}

export type AssumptionDriftAlert = {
  assumptionId: string;
  message: string;
  severity: "warning" | "critical";
};

export function buildDashboardAlerts(params: {
  uiState: DashboardUiState;
  hasBlockedOrder: boolean;
  recoveryRequired: boolean;
  pivotReviewOpen: boolean;
  healthMessage?: string;
  assumptionDrift?: AssumptionDriftAlert[];
  openFalseProgressCount?: number;
}): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  if (params.uiState === "LOCKED") {
    alerts.push({
      code: "HEALTH_LOCK",
      severity: "critical",
      message: params.healthMessage ?? "Execution is temporarily locked while the system repairs a critical issue.",
      actionHref: "/recovery",
      actionLabel: "View recovery",
    });
  }

  if (params.uiState === "RECOVERY") {
    alerts.push({
      code: "RECOVERY_MODE",
      severity: "warning",
      message: "Recovery stance is active. Complete the recovery execution order to restore normal progression.",
    });
  }

  if (params.hasBlockedOrder) {
    alerts.push({
      code: "DEPENDENCY_BLOCK",
      severity: "warning",
      message: "An execution order is blocked by an unmet dependency. Resolve the blocker before scaling output.",
      actionHref: "/orders",
      actionLabel: "View orders",
    });
  }

  if (params.recoveryRequired) {
    alerts.push({
      code: "CONDITION_RECOVERY",
      severity: "warning",
      message: "Your current condition requires deliberate recovery before normal scaling resumes.",
    });
  }

  if (params.pivotReviewOpen) {
    alerts.push({
      code: "PIVOT_OPEN",
      severity: "info",
      message: "A strategic pivot review is open. Resolve it to unlock full execution paths.",
      actionHref: "/strategy",
      actionLabel: "Review pivot",
    });
  }

  if (params.uiState === "PENDING_SYNC") {
    alerts.push({
      code: "PENDING_TASK",
      severity: "info",
      message: "The system is assembling your next execution order. This usually completes within a few seconds.",
    });
  }

  if ((params.openFalseProgressCount ?? 0) > 0) {
    alerts.push({
      code: "FALSE_PROGRESS",
      severity: "warning",
      message:
        "Activity may not be producing real outcome movement. Complete the corrective order before advancing phases or claiming outcome rewards.",
      actionHref: "/orders",
      actionLabel: "View corrective path",
    });
  }

  for (const drift of params.assumptionDrift ?? []) {
    alerts.push({
      code: `ASSUMPTION_DRIFT_${drift.assumptionId.slice(0, 8)}`,
      severity: drift.severity,
      message: drift.message,
      actionHref: "/validation",
      actionLabel: "Re-validate",
    });
  }

  return alerts;
}
