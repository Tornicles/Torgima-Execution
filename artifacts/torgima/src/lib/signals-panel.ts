import type { DashboardProjection } from "@/lib/dashboard-types";
import { getDashboardUiState } from "@/lib/dashboard-types";
import { formatEnforcementActions } from "@/lib/enforcement-actions";
import { getConditionLabel, LANGUAGE as LANG } from "@/lib/language";
import { getIdentityStageLabel } from "@/lib/language-map";
import type {
  ConditionPanelModel,
  FreshnessState,
  IdentityPanelModel,
  SignalDirection,
  SignalPanelItem,
  SignalPanelKey,
  SignalSummaryModel,
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

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function freshnessFromAgeMs(ageMs: number, pendingSync: boolean): FreshnessState {
  if (pendingSync) return "updating";
  if (ageMs < 60_000) return "live";
  if (ageMs < 5 * 60_000) return "recent";
  if (ageMs < SIX_HOURS_MS) return "warming";
  if (ageMs < TWENTY_FOUR_HOURS_MS) return "stale";
  return "outdated";
}

export function formatRelativeTime(iso?: string): string {
  if (!iso) return "recently";
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return "just now";
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function trendDirection(trend: string | null | undefined): SignalDirection {
  const t = (trend ?? "").toLowerCase();
  if (t === "improving" || t === "recovering" || t === "up" || t === "rising") return "up";
  if (t === "declining" || t === "down") return "down";
  return "flat";
}

function trendLabel(trend: string | null | undefined): string {
  const dir = trendDirection(trend);
  if (dir === "up") return "Rising";
  if (dir === "down") return "Declining";
  return "Stable";
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

function historyDaysForTier(tier: string): 7 | 30 | 90 {
  if (tier === "ultimate") return 90;
  if (tier === "growth") return 30;
  return 7;
}

function buildSignalSummary(state: DashboardProjection, tier: string): SignalSummaryModel {
  const breakdown = state.signal_breakdown;
  const sigState = state.signals as {
    consistency?: number;
    momentum?: number;
    streak?: number;
    velocity?: number;
    computedAt?: string;
  } | undefined;
  const sigProj = state.signalProjection as {
    completionRate?: number;
    weightedScore?: number;
    momentum?: number;
    trend?: string | null;
  } | null;

  const tasksInWindow = breakdown?.tasks_in_window ?? 0;
  const insufficient =
    (breakdown?.confidence ?? "").toLowerCase() === "insufficient_data" || tasksInWindow < 3;

  const completionRaw = breakdown?.completion_rate ?? sigProj?.completionRate ?? sigState?.consistency ?? 0;
  const completionRatePct = Math.round((completionRaw <= 1 ? completionRaw * 100 : completionRaw) || 0);
  const weightedNum = Number(breakdown?.weighted_score ?? sigProj?.weightedScore ?? 0);
  const workQualityNum = weightedNum <= 1 ? weightedNum * 10 : weightedNum;
  const momentumDays = Math.round(
    Number(breakdown?.momentum ?? sigProj?.momentum ?? sigState?.streak ?? 0),
  );
  const trend = breakdown?.trend ?? sigProj?.trend ?? "stable";
  const direction = trendDirection(trend);

  const healthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        Number(sigState?.velocity ?? (workQualityNum * 10 || completionRatePct)) || 0,
      ),
    ),
  );
  const calculatedAt = breakdown?.generated_at ?? sigState?.computedAt;
  const ageMs = calculatedAt ? Date.now() - new Date(calculatedAt).getTime() : Number.POSITIVE_INFINITY;
  const freshness = freshnessFromAgeMs(ageMs, Boolean(state.pendingSync));
  const freshnessLabel =
    freshness === "stale" || freshness === "outdated"
      ? LANG.signalsPanel.freshness[freshness]
      : LANG.signalsPanel.updatedAgo(formatRelativeTime(calculatedAt));

  const conditionKey = (
    state.activeCondition?.condition ??
    breakdown?.condition ??
    state.conditionDetail?.condition ??
    "stability"
  )
    .toString()
    .toLowerCase();

  const historyDays = historyDaysForTier(tier);
  const base = completionRatePct;
  const historyPoints = Array.from({ length: historyDays === 90 ? 12 : 7 }, (_, i) =>
    Math.max(0, Math.min(100, base + (i - 3) * 2)),
  );

  return {
    healthScore: Math.min(100, Math.max(0, healthScore)),
    healthLabel: getConditionLabel(conditionKey).label,
    completionRatePct,
    workQuality: workQualityNum.toFixed(1),
    momentumDays,
    directionLabel: trendLabel(trend),
    direction,
    hasData: !insufficient && tasksInWindow > 0,
    calculatedAt,
    freshness,
    freshnessLabel,
    historyDays,
    historyPoints,
  };
}

export function toSignalsPanelProjection(state: DashboardProjection): SignalsPanelProjection {
  const ui = getDashboardUiState(state);
  const health = state.health as { systemOperational?: boolean } | undefined;
  const degraded = health?.systemOperational === false;
  const errored = ui === "ERROR";

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
  const allowed = formatEnforcementActions(state.activeCondition?.allowed_actions ?? [], 4);
  const blocked = formatEnforcementActions(state.activeCondition?.blocked_actions ?? [], 4);
  const durationDays =
    typeof state.conditionDetail?.durationDays === "number"
      ? state.conditionDetail.durationDays
      : 0;

  const signals: SignalPanelItem[] = SIGNAL_KEYS.map((key) => {
    const label = LANG.signalsPanel.signalLabels[key];
    const explanation = LANG.signalsPanel.signalExplain[key];
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
      rawValue = `${momentum >= 0 ? momentum : momentum} days active`;
    } else if (key === "trend") {
      direction = trendDir;
      status = statusFromMetrics({ insufficient, trend: direction });
      rawValue = trendLabel(trend);
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
    stage?: string | null;
    stageLabel?: string | null;
    stageDescription?: string | null;
    transformationMessage?: string | null;
    nextStageLabel?: string | null;
    progressToNext?: number | null;
    currentStreakDays?: number | null;
    daysActiveThisMonth?: number | null;
    milestonesCompleted?: number | null;
    regressionRisk?: string;
    description?: string | null;
    summary?: string | null;
  } | undefined;

  const stageEnum =
    identityRaw?.stage && identityRaw.stage === identityRaw.stage.toUpperCase()
      ? identityRaw.stage.toUpperCase()
      : null;
  const label = stageEnum
    ? getIdentityStageLabel(stageEnum)
    : getIdentityStageLabel(identityRaw?.stageLabel ?? identityRaw?.stage ?? "UNFORMED");

  const completed = state.tasksCompletedThisWeek ?? state.tasksCompletedToday ?? 0;
  const streak = state.streakDays ?? identityRaw?.currentStreakDays ?? sigState?.streak ?? 0;
  const regression =
    label === getIdentityStageLabel("REGRESSING") ||
    identityRaw?.regressionRisk === "HIGH" ||
    identityRaw?.regressionRisk === "CRITICAL"
      ? "A lighter load and one recovery win can reset momentum."
      : undefined;

  const identity: IdentityPanelModel = {
    stageKey: stageEnum ?? "UNFORMED",
    label,
    description:
      identityRaw?.stageDescription ??
      identityRaw?.description ??
      identityRaw?.summary ??
      LANG.identity.stages.BUILDING.description,
    progressToNext: Math.min(100, Math.max(0, Number(identityRaw?.progressToNext ?? 0))),
    nextStageLabel: identityRaw?.nextStageLabel ?? LANG.signalsPanel.nextStage("your next stage"),
    transformationMessage:
      identityRaw?.transformationMessage ??
      "Keep completing tasks and sharing honest updates — your pattern is what matters.",
    daysActiveThisMonth: identityRaw?.daysActiveThisMonth ?? Math.max(streak, 0),
    milestonesCompleted: identityRaw?.milestonesCompleted ?? completed,
    currentStreakDays: streak,
    evidenceSummary: `${LANG.signalsPanel.evidencePrefix} ${completed} completed tasks over ${Math.max(streak, 1)} active day${streak === 1 ? "" : "s"}.`,
    growthEdge: `${LANG.signalsPanel.growthEdgePrefix}: ${condDisplay.nextStep}`,
    regressionNote: regression,
  };

  const condition: ConditionPanelModel = {
    conditionKey,
    label: state.conditionLabel ?? condDisplay.label,
    description: condDisplay.description,
    durationDays,
    durationLabel: LANG.signalsPanel.conditionDuration(
      state.conditionLabel ?? condDisplay.label,
      durationDays,
    ),
    allowedActions: allowed.length
      ? allowed
      : ["Work on your current task", "Submit progress updates"],
    restrictedActions: blocked.map((b) => `${b} — ${LANG.signalsPanel.comingSoon}`),
    nextUnlock: condDisplay.nextStep,
    transitionReason:
      typeof state.conditionDetail?.transitionReason === "string"
        ? state.conditionDetail.transitionReason
        : null,
    explanation:
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

  let panelState: SignalsPanelProjection["panelState"] = "ready";
  let errorMessage: string | undefined;
  if (errored) {
    panelState = "error";
    errorMessage = LANG.signalsPanel.healthUnavailable;
  } else if (degraded) {
    panelState = "degraded";
    errorMessage = LANG.signalsPanel.systemUpdating;
  } else if (insufficient && !breakdown) {
    panelState = "no_data";
  }

  return {
    tier,
    condition,
    signalSummary: buildSignalSummary(state, tier),
    signals,
    identity,
    blueprintId: state.blueprintId ?? (state.activeBlueprint as { id?: string } | undefined)?.id ?? null,
    generatedAt: breakdown?.generated_at,
    panelState,
    errorMessage,
  };
}
