/** DOC23 — approved decision trace types and shared interfaces. */

export const DOC23_DECISION_TYPES = [
  "USER_STRATEGIC",
  "USER_EXECUTION",
  "SYSTEM_CONTROL",
  "SYSTEM_GENERATION",
  "SYSTEM_CORRECTION",
  "AI_ASSISTED",
  "ADMIN_REPAIR",
] as const;

export type Doc23DecisionType = (typeof DOC23_DECISION_TYPES)[number];

export type TraceConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface DecisionTraceWriteInput {
  userId: string;
  blueprintId: string;
  orderId?: string;
  decisionType: Doc23DecisionType;
  decisionKey: string;
  selectedOption: string;
  optionsConsidered: string[];
  rejectedOptions?: string[];
  rationaleSummary: string;
  evidenceIds?: string[];
  sourceEngine: string;
  confidence?: TraceConfidence;
  stateVersion?: number;
  causationEventId?: string;
}

export type CognitiveLoadLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CognitiveLoadInput {
  choiceCount: number;
  unresolvedDecisionCount: number;
  reversalCount: number;
  ambiguityCount: number;
  /** 0–100 friction average. */
  frictionScoreAverage: number;
  condition: string | null;
  taskComplexity: string | null;
}

export interface CognitiveLoadAssessment {
  score: number;
  level: CognitiveLoadLevel;
  recommendation?: string;
}
