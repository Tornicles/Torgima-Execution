import type { DashboardProjection } from "@/lib/dashboard-types";
import { formatEnforcementActions } from "@/lib/enforcement-actions";
import { getConditionLabel, LANGUAGE } from "@/lib/language";
import type {
  ConditionPanelModel,
  FreshnessState,
  IdentityPanelModel,
  SignalDirection,
  SignalPanelItem,
  SignalPanelKey,
  SignalsPanelProjection,
  SignalStatusText,
} from "@/types/signals-panel";

const SIGNAL_KEYS: SignalPanelKey[] = [
  "completion_rate",
  "score",
  "momentum",
  "trend",
  "confidence",
  "consistency",
  "fatigue_risk",
];

export function freshnessFromAgeMs(ageMs: number, pendingSync: boolean): FreshnessState {
  if (pendingSync) return "updating";
  if (ageMs < 60_000) return "live";
  if (ageMs < 5 * 60_000) return "recent";
  if (ageMs < 15 * 60_000) return "warming";
  return "stale";
}

function trendDirection(trend: string | null | undefined): SignalDirection {
  const t = (trend ?? "").toLowerCase();
  if (t === "improving" || t === "recovering" || t === "up") return "up";
  if (t === "declining" || t === "down") return "down";
  return "flat";
}

function statusFromMetrics(params: {
  insufficient: boolean;
  trend: SignalDirection;
  strength?: number;
}): SignalStatusText {
  if (params.insufficient) return "Insufficient Data";
  if (params.trend === "up" && (params.strength ?? 0) >= 0.65) return "Strong";
  if (params.trend === "up") return "Improving";
  if (params.trend === "down") return "Declining";
  return "Stable";
}

function fatigueStatus(blockerRatio: number | null | undefined, skipRatio: number | null | undefined): SignalStatusText {
  const b = blockerRatio ?? 0;
  const s = skipRatio ?? 0;
  if (b + s < 0.05) return "Strong";
  if (b + s < 0.15) return "Stable";
  if (b + s < 0.3) return "Declining";
  return "Insufficient Data";
}

export function toSignalsPanelProjection(state: DashboardProjection): SignalsPanelProjection {
  const breakdown = state.signal_breakdown;
  const sigProj = state.signalProjection as {
    completionRate?: number;
    weightedScore?: number;
    momentum?: number;
    trend?: string | null;
    confidence?: string | null;
    blockerRatio?: number | null;
    skipRatio?: number | null;
  } | null;
  const sigState = state.signals as { consistency?: number; momentum?: number; streak?: number } | undefined;

  const tasksInWindow = breakdown?.tasks_in_window ?? 0;
  const insufficient =
    (breakdown?.confidence ?? sigProj?.confidence ?? "").toLowerCase() === "insufficient_data" ||
    tasksInWindow < 3;

  const completion =
    breakdown?.completion_rate ?? sigProj?.completionRate ?? sigState?.consistency ?? 0;
  const score = breakdown?.weighted_score ?? sigProj?.weightedScore ?? 0;
  const momentum = breakdown?.momentum ?? sigProj?.momentum ?? sigState?.momentum ?? 0;
  const trend = breakdown?.trend ?? sigProj?.trend ?? "stable";
  const trendDir = trendDirection(trend);

  const conditionKey = (
    state.activeCondition?.condition ??
    breakdown?.condition ??
    state.conditionDetail?.condition ??
    "stability"
  )
    .toString()
    .toLowerCase();
  const condDisplay = getConditionLabel(conditionKey);
  const allowed = formatEnforcementActions(
    state.activeCondition?.allowed_actions ?? [],
    3,
  );
  const blocked = formatEnforcementActions(
    state.activeCondition?.blocked_actions ?? [],
    3,
  );

  const signals: SignalPanelItem[] = SIGNAL_KEYS.map((key) => {
    const label = LANGUAGE.signalsPanel.signalLabels[key];
    const explanation = LANGUAGE.signalsPanel.signalExplain[key];
    let direction: SignalDirection = "flat";
    let status: SignalStatusText = "Stable";
    let rawValue: string | undefined;

    if (key === "completion_rate") {
      direction = trendDir;
      status = statusFromMetrics({ insufficient, trend: direction, strength: completion });
      rawValue = `${Math.round((completion <= 1 ? completion * 100 : completion) || 0)}%`;
    } else if (key === "score") {
      direction = score >= 7 ? "up" : score >= 5 ? "flat" : "down";
      status = statusFromMetrics({ insufficient, trend: direction, strength: score / 10 });
      rawValue = `${(score <= 1 ? score * 10 : score).toFixed(1)} / 10`;
    } else if (key === "momentum") {
      direction = momentum > 0 ? "up" : momentum < 0 ? "down" : "flat";
      status = statusFromMetrics({ insufficient, trend: direction });
      rawValue = `${momentum >= 0 ? "+" : ""}${momentum}`;
    } else if (key === "trend") {
      direction = trendDir;
      status = statusFromMetrics({ insufficient, trend: direction });
      rawValue = LANGUAGE.progress.direction_values[trend as keyof typeof LANGUAGE.progress.direction_values] ?? trend;
    } else if (key === "confidence") {
      const conf = (breakdown?.confidence ?? sigProj?.confidence ?? "low").toString();
      direction = conf.includes("high") ? "up" : conf.includes("low") || insufficient ? "down" : "flat";
      status = insufficient ? "Insufficient Data" : conf.includes("high") ? "Strong" : "Stable";
      rawValue = conf.replace(/_/g, " ");
    } else if (key === "consistency") {
      const c = sigState?.consistency ?? completion;
      direction = c >= 0.65 ? "up" : c >= 0.4 ? "flat" : "down";
      status = statusFromMetrics({ insufficient, trend: direction, strength: c });
      rawValue = `${Math.round((c <= 1 ? c * 100 : c) || 0)}%`;
    } else if (key === "fatigue_risk") {
      status = insufficient ? "Insufficient Data" : fatigueStatus(sigProj?.blockerRatio, sigProj?.skipRatio);
      direction = status === "Declining" ? "down" : status === "Strong" ? "up" : "flat";
      rawValue = status;
    }

    return { key, label, direction, status, explanation, rawValue };
  });

  const identityRaw = state.identity as {
    stage?: string;
    regressionRisk?: string;
  } | undefined;
  const stageKey = (identityRaw?.stage ?? "UNFORMED").toUpperCase();
  const stageCopy =
    LANGUAGE.identity.stages[stageKey as keyof typeof LANGUAGE.identity.stages] ??
    LANGUAGE.identity.stages.UNFORMED;
  const completed = state.tasksCompletedThisWeek ?? state.tasksCompletedToday ?? 0;
  const streak = state.streakDays ?? sigState?.streak ?? 0;
  const regression =
    stageKey === "REGRESSING" || identityRaw?.regressionRisk === "HIGH" || identityRaw?.regressionRisk === "CRITICAL"
      ? "Your pace has slowed recently — focus on small, completable steps."
      : undefined;

  const identity: IdentityPanelModel = {
    stageKey,
    label: stageCopy.label,
    description: stageCopy.description,
    evidenceSummary: `${LANGUAGE.signalsPanel.evidencePrefix} ${completed} completed tasks over ${Math.max(streak, 1)} active day${streak === 1 ? "" : "s"}.`,
    growthEdge: `${LANGUAGE.signalsPanel.growthEdgePrefix}: ${condDisplay.nextStep}`,
    regressionNote: regression,
  };

  const condition: ConditionPanelModel = {
    conditionKey,
    label: state.conditionLabel ?? condDisplay.label,
    description: condDisplay.description,
    allowedActions: allowed.length ? allowed : ["Start or continue your current task", "Submit feedback"],
    restrictedActions: blocked,
    nextUnlock: condDisplay.nextStep,
    transitionReason:
      typeof state.conditionDetail?.transitionReason === "string"
        ? state.conditionDetail.transitionReason
        : null,
  };

  const tier = (
    state.blueprintTier ??
    (state.activeBlueprint as { blueprintTier?: string } | undefined)?.blueprintTier ??
    "starter"
  )
    .toString()
    .toLowerCase();

  return {
    tier,
    condition,
    signals,
    identity,
    blueprintId: state.blueprintId ?? (state.activeBlueprint as { id?: string } | undefined)?.id ?? null,
    generatedAt: breakdown?.generated_at,
  };
}
