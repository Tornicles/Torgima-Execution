/** DOC22 — shared failure classification types and constants. */

export const FAILURE_CATEGORIES = [
  "CLARITY_FAILURE",
  "CAPABILITY_FAILURE",
  "CAPACITY_FAILURE",
  "DEPENDENCY_FAILURE",
  "MOTIVATION_FRICTION",
  "SYSTEM_FRICTION",
  "WRONG_PRIORITY",
  "OUTCOME_MISMATCH",
  "EXTERNAL_BLOCKER",
  "PROOF_FAILURE",
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export type ClassificationConfidence = "LOW" | "MEDIUM" | "HIGH";
export type ClassificationSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
