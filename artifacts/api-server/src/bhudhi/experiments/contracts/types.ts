export type HypothesisType =
  | "behavioral"
  | "execution"
  | "economic"
  | "simulation"
  | "identity"
  | "strategy";

export type ExperimentStatus = "PENDING" | "RUNNING" | "PAUSED" | "COMPLETE" | "TERMINATED";
export type AllocationMethod = "random" | "weighted" | "stratified" | "adaptive";
export type ComparisonVerdict = "winner" | "loser" | "neutral" | "inconclusive";
export type PromotionAction = "promote" | "repeat" | "archive" | "reject";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "STANDARDIZED";

export interface Hypothesis {
  claim: string;
  reason: string;
  expectedOutcome: string;
  risk: number;
  validationPlan: string;
  type: HypothesisType;
  falsifiable: boolean;
}

export interface ExperimentGroup {
  id: string;
  groupKey: string;
  label: string;
  allocationWeight: number;
}

export interface ExperimentInput {
  blueprintId: string;
  goal: string;
  belief?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  worldState?: Record<string, unknown>;
  constraints?: string[];
  metrics?: string[];
  hypothesisType?: HypothesisType;
}

export interface ExperimentCreateResult {
  experimentId: string;
  hypothesis: Hypothesis;
  groups: ExperimentGroup[];
  duration: number;
  successCriteria: Record<string, unknown>;
}

export interface MeasurementResult {
  delta: number;
  confidence: number;
  effectSize: number;
  impact?: number;
  quality?: number;
  speed?: number;
}

export interface ComparisonResult {
  verdict: ComparisonVerdict;
  winner?: string;
  loser?: string;
  summary: string;
}

export interface CausalResult {
  causes: string[];
  confidence: number;
  replicability: number;
}

export interface PromotionResult {
  action: PromotionAction;
  allowed: boolean;
  reason: string;
}
