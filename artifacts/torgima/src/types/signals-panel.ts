export type FreshnessState = "live" | "recent" | "warming" | "stale" | "outdated" | "updating";

export type SignalDirection = "up" | "down" | "flat";

export type SignalStatusText =
  | "Strong"
  | "Improving"
  | "Stable"
  | "Declining"
  | "Insufficient Data";

export type SignalPanelKey =
  | "completion_rate"
  | "score"
  | "momentum"
  | "trend"
  | "confidence"
  | "consistency"
  | "fatigue_risk";

export type SignalPanelItem = {
  key: SignalPanelKey;
  label: string;
  direction: SignalDirection;
  status: SignalStatusText;
  explanation: string;
  rawValue?: string;
};

/** DOC 35 — primary health score + four breakdown metrics from projection. */
export type SignalSummaryModel = {
  healthScore: number;
  healthLabel: string;
  completionRatePct: number;
  workQuality: string;
  momentumDays: number;
  directionLabel: string;
  direction: SignalDirection;
  hasData: boolean;
  calculatedAt?: string;
  freshness: FreshnessState;
  freshnessLabel: string;
  historyDays: 7 | 30 | 90;
  historyPoints: number[];
};

export type ConditionPanelModel = {
  conditionKey: string;
  label: string;
  description: string;
  durationDays: number;
  durationLabel: string;
  allowedActions: string[];
  restrictedActions: string[];
  nextUnlock: string;
  transitionReason?: string | null;
  explanation?: string | null;
};

export type IdentityPanelModel = {
  stageKey: string;
  label: string;
  description: string;
  progressToNext: number;
  nextStageLabel: string;
  transformationMessage: string;
  daysActiveThisMonth: number;
  milestonesCompleted: number;
  currentStreakDays: number;
  evidenceSummary: string;
  growthEdge: string;
  regressionNote?: string;
};

export type SignalsPanelProjection = {
  tier: string;
  condition: ConditionPanelModel;
  signalSummary: SignalSummaryModel;
  signals: SignalPanelItem[];
  identity: IdentityPanelModel;
  blueprintId: string | null;
  generatedAt?: string;
  panelState: "ready" | "no_data" | "error" | "degraded";
  errorMessage?: string;
};
