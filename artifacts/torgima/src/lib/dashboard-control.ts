import type { DashboardProjection } from "@/lib/dashboard-types";
import { getDashboardUiState } from "@/lib/dashboard-types";
import { INTERNAL_TERM_LABELS, LANGUAGE } from "@/lib/language";
import type {
  DashboardControlProjection,
  DependencyAlert,
  OrderSummary,
  RecoveryAlert,
  SignalSummaryStrip,
} from "@/types/dashboard";

export type DashboardShellState =
  | "LOADING"
  | "NO_BLUEPRINT"
  | "LOCKED"
  | "PENDING_SYNC"
  | "RECOVERY"
  | "ACTIVE";

export function getConditionUiMode(condition: string): "gentle" | "recovery" | "warning" | "full" {
  const key = condition.toLowerCase();
  if (key === "nothingness") return "gentle";
  if (key === "danger") return "recovery";
  if (key === "urgency") return "warning";
  return "full";
}

export function shouldReduceMotion(condition: string): boolean {
  const mode = getConditionUiMode(condition);
  return mode === "recovery" || mode === "warning";
}

function mapOrderSummary(action: Record<string, unknown> | null | undefined): OrderSummary | null {
  if (!action) return null;
  const orderId = String(action.orderId ?? action.id ?? "");
  if (!orderId) return null;
  const allowed = Array.isArray(action.allowedActions)
    ? action.allowedActions.map(String)
    : Array.isArray(action.allowed_actions)
      ? (action.allowed_actions as string[]).map(String)
      : [];
  return {
    orderId,
    title: String(action.title ?? "Next step"),
    instruction: String(action.instruction ?? ""),
    difficulty: String(action.difficulty ?? "moderate"),
    timeEstimate:
      (action.timeEstimate as number | undefined) ??
      (action.timeEstimateMinutes as number | undefined) ??
      null,
    timeEstimateMinutes: action.timeEstimateMinutes as number | undefined,
    proofRequired: Boolean(action.proofRequired),
    allowedActions: allowed,
    priorityReason:
      (action.priorityReason as string | null | undefined) ??
      (action.whyItMatters as string | null | undefined) ??
      null,
    status: action.status as string | undefined,
  };
}

function mapSignalSummary(state: DashboardProjection): SignalSummaryStrip {
  const sig = state.signals as { completionRate?: number; momentum?: number; trend?: string } | undefined;
  const breakdown = state.signal_breakdown;
  const sigProj = state.signalProjection as { trend?: string } | undefined;
  return {
    completionRate:
      breakdown?.completion_rate ??
      (sig?.completionRate != null ? Number(sig.completionRate) : undefined),
    momentum: breakdown?.momentum ?? (sig?.momentum != null ? Number(sig.momentum) : undefined),
    trend: breakdown?.trend ?? sig?.trend ?? sigProj?.trend,
    label: state.simplifiedSignalLabel ?? undefined,
  };
}

export function toDashboardControlProjection(
  state: DashboardProjection,
): DashboardControlProjection {
  const conditionRaw =
    state.conditionDetail?.condition ??
    state.activeCondition?.condition ??
    (state.signals as { condition?: string } | undefined)?.condition ??
    "stability";
  const condition = String(conditionRaw);
  const conditionKey = condition.toLowerCase() as keyof typeof INTERNAL_TERM_LABELS;
  const conditionLabel =
    (state as { conditionLabel?: string }).conditionLabel ??
    (conditionKey in INTERNAL_TERM_LABELS
      ? INTERNAL_TERM_LABELS[conditionKey]
      : LANGUAGE.condition.states.stability.label);

  const alerts = state.alerts ?? [];
  const dependencyAlert: DependencyAlert | undefined = alerts.find((a) =>
    a.code.startsWith("DEPENDENCY") || a.code === "DEPENDENCY_BLOCK",
  )
    ? {
        message:
          alerts.find((a) => a.code === "DEPENDENCY_BLOCK")?.message ??
          "Something is blocking your next step.",
        actionHref: alerts.find((a) => a.code === "DEPENDENCY_BLOCK")?.actionHref,
        actionLabel: alerts.find((a) => a.code === "DEPENDENCY_BLOCK")?.actionLabel,
      }
    : undefined;

  const recoveryAlert: RecoveryAlert | undefined =
    getDashboardUiState(state) === "RECOVERY" ||
    alerts.some((a) => a.code === "RECOVERY_MODE" || a.code === "CONDITION_RECOVERY")
      ? {
          message:
            alerts.find((a) => a.code === "RECOVERY_MODE")?.message ??
            "Focus on the recovery step below to restore normal execution.",
          actionHref: "/recovery",
        }
      : undefined;

  const identity = state.identity;
  const reward = state.latestReward;

  return {
    stateVersion: state.stateVersion ?? 0,
    blueprintId:
      (state as { blueprintId?: string | null }).blueprintId ??
      state.activeBlueprint?.id ??
      null,
    condition,
    conditionLabel,
    currentAction: mapOrderSummary(
      (state.currentAction as Record<string, unknown> | null | undefined) ?? null,
    ),
    pendingSync: Boolean(state.pendingSync) || getDashboardUiState(state) === "PENDING_SYNC",
    locked:
      Boolean((state as { locked?: boolean }).locked) ||
      getDashboardUiState(state) === "LOCKED",
    lockReason: (state as { lockReason?: string }).lockReason,
    signalSummary: mapSignalSummary(state),
    dependencyAlert,
    recoveryAlert,
    identitySnapshot: identity
      ? {
          stage: identity.stage ?? undefined,
          label: identity.label ?? undefined,
          description:
            (identity as { description?: string }).description ??
            (identity as { summary?: string | null }).summary ??
            undefined,
        }
      : undefined,
    rewardSnapshot: reward
      ? {
          type: (reward as { type?: string }).type,
          label: (reward as { label?: string }).label ?? (reward as { rewardType?: string }).rewardType,
          message:
            (reward as { message?: string }).message ??
            (reward as { description?: string }).description,
        }
      : undefined,
  };
}

export function resolveDashboardShellState(params: {
  loading: boolean;
  projection: DashboardProjection | null;
}): DashboardShellState {
  if (params.loading || !params.projection) return "LOADING";
  const ui = getDashboardUiState(params.projection);
  const control = toDashboardControlProjection(params.projection);
  if (ui === "NO_BLUEPRINT" || !control.blueprintId) return "NO_BLUEPRINT";
  if (control.locked || ui === "LOCKED") return "LOCKED";
  if (control.pendingSync && !control.currentAction) return "PENDING_SYNC";
  if (ui === "RECOVERY" || control.recoveryAlert) return "RECOVERY";
  return "ACTIVE";
}
