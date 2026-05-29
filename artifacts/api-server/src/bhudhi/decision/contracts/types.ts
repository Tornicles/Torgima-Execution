/** BHUDHI Decision Intelligence Engine — contracts */

export type DecisionOptionType =
  | "conservative"
  | "balanced"
  | "aggressive"
  | "experimental"
  | "counterfactual";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "CERTAIN";

export type DecisionStatus = "pending" | "formed" | "approved" | "executed" | "rejected";

export interface DecisionOption {
  id: string;
  option: string;
  /** Display label (alias of `option` when set). */
  label?: string;
  optionType: DecisionOptionType;
  description: string;
  cost: number;
  timeline: number;
  risk: number;
  confidence: number;
  expectedValue?: number;
  tradeoffs?: Record<string, number>;
}

export interface DecisionInput {
  trigger: string;
  goal: string;
  blueprintId: string;
  recommendationId?: string;
  context?: Record<string, unknown>;
  memory?: string[];
  signals?: { global?: string; confidence?: number };
  conditions?: Record<string, unknown>;
  simulation?: Record<string, unknown>;
  constraints?: string[];
}

export interface TradeoffMatrix {
  time: number;
  money: number;
  complexity: number;
  lifeImpact: number;
  confidence: number;
  executionEffort: number;
  risk: number;
  learningValue: number;
  summary: string;
}

export interface ScenarioForecast {
  horizonDays: number;
  bestOutcome: number;
  expectedOutcome: number;
  worstOutcome: number;
  probabilities: { best: number; expected: number; worst: number };
  scenarioTree: Array<{ branch: string; probability: number }>;
}

export interface ExpectedValueResult {
  expectedValue: number;
  regret: number;
  upside: number;
  downside: number;
  recommendation: string;
}

export interface DecisionConfidenceResult {
  level: ConfidenceLevel;
  score: number;
  dimensions: {
    data: number;
    simulation: number;
    memory: number;
    agreement: number;
    evidence: number;
  };
}

export interface DecisionApproval {
  ready: boolean;
  requiresGovernance: boolean;
  reason: string;
}

export interface DecisionResult {
  decisionId: string;
  options: DecisionOption[];
  selected: DecisionOption;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  explanation: string;
  approval: DecisionApproval;
  tradeoffMatrix?: TradeoffMatrix;
  forecasts?: ScenarioForecast[];
  expectedValue?: ExpectedValueResult;
  meta?: { quality: number; speed: string; drift: number; action: string };
}

export interface DecisionRecord {
  decisionId: string;
  timestamp: string;
  reason: string;
  winner: string;
  actualOutcome?: unknown;
}
