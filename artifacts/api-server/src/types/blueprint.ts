export type BlueprintStatus =
  | "draft"
  | "validating"
  | "path_selection"
  | "active"
  | "paused"
  | "complete"
  | "abandoned";

export type BlueprintDomain =
  | "genesis"
  | "market"
  | "delivery"
  | "operations"
  | "people"
  | "growth"
  | "continuity";

export interface Blueprint {
  id: string;
  userId: string;
  title: string;
  rawGoal: string;
  domain: string;
  status: BlueprintStatus;
  phase: number;
  totalPhases: number;
  currentCondition: string | null;
  pausedReason: string | null;
  activatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BlueprintState {
  blueprint: Blueprint;
  activeOrders: import("./order.js").Order[];
  signals: import("./signal.js").SignalState;
  condition: string;
  phaseProgress: number;
  /** Prompt 14 — extended projection fields */
  pivotReviewOpen: boolean;
  pivotReviewId: string | null;
  completionEligible: boolean;
  pausedAt: string | null;
}

export interface BlueprintDraftInput {
  goal: string;
  purpose?: string | null;
  timeframeDays?: number | null;
  domainHint?: string | null;
  commitmentLevel?: "low" | "medium" | "high" | "full" | null;
}

export interface PlanInput {
  name: string;
  description?: string;
  orderIndex?: number;
}

export interface TargetInput {
  name: string;
  description?: string;
  type: "major" | "primary" | "vital" | "operating" | "production" | "conditional";
  metric?: string;
  targetValue?: number;
  unit?: string;
}

// Spec shape (Prompt 1 §types/blueprint): the full input contract used by
// `BlueprintEngine.buildBlueprintChain` when a validation path skeleton is
// being applied. Carries the chosen path identifier plus the full plan/target
// skeleton required to materialise the chain.
export interface BlueprintChainInput {
  goal:             string;
  purpose?:         string;
  timeframeDays?:   number;
  roleContext?:     string;
  domainHint?:      string;
  commitmentLevel?: "low" | "medium" | "high" | "full";
  selectedPath?:    "current" | "adjusted" | "alternative";
  validationId?:    string;
  pathSummary?: {
    plans:      PlanInput[];
    targets:    TargetInput[];
    keyActions: string[];
  };
}

// Legacy single-plan/multi-target shape kept for the older buildChain entrypoint.
export interface BlueprintChainSimpleInput {
  plan:    PlanInput;
  targets: TargetInput[];
}

export interface BlueprintPosition {
  blueprintId: string;
  currentPlanId: string | null;
  currentPhaseId: string | null;
  currentPhaseIndex: number;
  totalPhases: number;
  phaseProgressPercent: number;
  currentPlanName: string | null;
  currentPhaseName: string | null;
  phaseStatus: string | null;
}

export interface BlueprintStateView {
  blueprintId: string;
  goal: string;
  domain: string;
  status: BlueprintStatus;
  condition: string | null;
  position: BlueprintPosition;
  enforcement: {
    taskLimits: Record<string, unknown>;
    difficultyCap: string;
    allowedActions: string[];
    blockedActions: string[];
    aiMode: string | null;
    uiMode: string | null;
  } | null;
  pausedAt: string | null;
  pauseReason: string | null;
  activatedAt: string | null;
  createdAt: string;
}
