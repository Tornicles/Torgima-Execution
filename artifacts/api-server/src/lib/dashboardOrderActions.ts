import { OrderStatus } from "@workspace/state-machine";
import type { DashboardUiState } from "../services/DashboardUiState.js";

/** DOC 33 — user-facing action keys for CurrentActionPanel (backend-derived only). */
export function deriveOrderAllowedActions(params: {
  orderStatus?: string | null;
  uiState: DashboardUiState;
  systemOperational: boolean;
  hasAwaitingFeedbackOrder: boolean;
  enforcementAllowed?: string[];
}): string[] {
  if (!params.systemOperational) return ["refresh"];

  if (params.hasAwaitingFeedbackOrder) {
    return ["submit_feedback", "view_details"];
  }

  const actions = new Set<string>(["view_details", "refresh"]);
  const status = params.orderStatus ?? null;

  if (status === OrderStatus.PENDING) actions.add("start");
  if (status === OrderStatus.ACTIVE) {
    actions.add("continue");
    actions.add("submit_feedback");
  }
  if (params.uiState === "RECOVERY" || params.uiState === "BLOCKED") {
    actions.add("report_blocked");
  }
  if (params.uiState === "AWAITING_FEEDBACK") {
    actions.add("submit_feedback");
  }

  const enf = new Set((params.enforcementAllowed ?? []).map((a) => a.toLowerCase()));
  if (enf.size > 0) {
    const filtered = [...actions].filter((key) => {
      if (key === "refresh" || key === "view_details") return true;
      if (key === "start" || key === "continue") return enf.has("execution") || enf.has("task_execution");
      if (key === "submit_feedback") return enf.has("execution") || enf.has("feedback_submission");
      if (key === "report_blocked") {
        return enf.has("blocker_resolution") || enf.has("recovery");
      }
      return true;
    });
    return filtered.length > 0 ? filtered : ["refresh", "view_details"];
  }

  return [...actions];
}

export const CONDITION_USER_LABELS: Record<string, string> = {
  nothingness: "Getting Started",
  danger: "Needs Attention",
  urgency: "Rebuild Momentum",
  stability: "Steady Progress",
  power: "Strong Momentum",
  affluence: "Peak Execution",
  power_change: "Momentum Shift",
};

export function conditionUserLabel(condition: string | null | undefined): string {
  if (!condition) return "Execution state";
  const key = condition.toLowerCase().replace(/\s+/g, "_");
  return CONDITION_USER_LABELS[key] ?? condition;
}
