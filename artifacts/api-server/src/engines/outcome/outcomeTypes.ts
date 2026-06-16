/**
 * DOC20 — shared outcome validation types.
 */

export type ValidationStatus =
  | "VALIDATED"
  | "PARTIALLY_VALIDATED"
  | "NEEDS_MORE_EVIDENCE"
  | "UNVALIDATED"
  | "CONTRADICTED"
  | "FALSE_PROGRESS";

export const VALIDATION_STATUSES: ValidationStatus[] = [
  "VALIDATED",
  "PARTIALLY_VALIDATED",
  "NEEDS_MORE_EVIDENCE",
  "UNVALIDATED",
  "CONTRADICTED",
  "FALSE_PROGRESS",
];

export type LedgerEvidenceRow = {
  evidence_strength?: string | null;
  evidence_class?: string | null;
  contradiction_status?: string | null;
  validation_status?: string | null;
  integrity_flags?: string[] | null;
};

export type ExecutionDataSnapshot = {
  completedCount14d: number;
  completedCount7d: number;
  totalTasks14d: number;
  alignedTasks14d: number;
  hasClaim: boolean;
  hasPaymentOrExternalProof: boolean;
  demandSignalDelta?: number;
  falseProgressSignal?: number;
  claimComplete?: boolean;
  repeatedSameTaskType?: number;
  sequenceDependencyOpenDays?: number;
  easyTaskOnly?: boolean;
};

export type OutcomeScoringResult = {
  evidenceScore: number;
  outcomeMovementScore: number;
  alignmentScore: number;
  contradictionScore: number;
  confidence: "high" | "medium" | "low";
};
