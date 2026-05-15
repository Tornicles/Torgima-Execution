export type ValidationVerdict = "proceed" | "adjust" | "pivot";

export interface GoalDimension {
  score: number;
  verdict: "strong" | "acceptable" | "weak" | "critical";
  finding: string;
  suggestion?: string;
}

export interface ValidationScores {
  clarity:     GoalDimension;
  feasibility: GoalDimension;
  realism:     GoalDimension;
  usefulness:  GoalDimension;
  overall:     number;
}

export interface ValidationPath {
  type:             "current" | "adjusted" | "alternative";
  title:            string;
  summary:          string;
  rationale:        string;
  expectedOutcome:  string;
  riskLevel:        "low" | "medium" | "high";
  timeframeNote?:   string;
  keyChanges?:      string;
  planSkeleton: {
    plans:   Array<{ name: string; description: string }>;
    targets: Array<{ name: string; type: string }>;
  };
}

export interface ValidationResult {
  validationId:  string;
  blueprintId:   string;
  verdict:       ValidationVerdict;
  scores:        ValidationScores;
  paths:         { current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath };
  usedFallback:  boolean;
  aiSummary?:    string;
  createdAt:     Date;
  launchBlocked?: boolean;
  readiness?: string;
  intelligence?: Record<string, unknown>;
  industryPanel?: Record<string, unknown>;
  tabs?: Record<string, unknown>;
  blueprintContract?: Record<string, unknown> | null;
  systemsProgress?: Record<string, string>;
}

export interface StructuredGoalDraft {
  cleanedGoal:           string;
  purpose:               string;
  timeframe:             string;
  commitmentLevel:       "low" | "medium" | "high" | "full";
  currentContext:        string;
  successSignals:        string[];
  blockers:              string[];
  domainHints:           string[];
  missingRequiredFields: string[];
  ambiguityFlags:        string[];
  validationVerdict:     "VALID" | "NEEDS_CLARIFICATION" | "INVALID";
}

export interface OnboardingGoalInput {
  rawGoal:          string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: "low" | "medium" | "high" | "full";
  currentContext?:  string;
  successSignal?:   string;
  knownBlockers?:   string;
  domainHints?:     string[];
  idempotencyKey:   string;
}
