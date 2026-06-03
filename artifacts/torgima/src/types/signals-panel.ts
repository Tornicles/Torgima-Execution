export type FreshnessState = "live" | "recent" | "warming" | "stale" | "updating";

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

export type ConditionPanelModel = {
  conditionKey: string;
  label: string;
  description: string;
  allowedActions: string[];
  restrictedActions: string[];
  nextUnlock: string;
  transitionReason?: string | null;
};

export type IdentityPanelModel = {
  stageKey: string;
  label: string;
  description: string;
  evidenceSummary: string;
  growthEdge: string;
  regressionNote?: string;
};

export type SignalsPanelProjection = {
  tier: string;
  condition: ConditionPanelModel;
  signals: SignalPanelItem[];
  identity: IdentityPanelModel;
  blueprintId: string | null;
  generatedAt?: string;
};
