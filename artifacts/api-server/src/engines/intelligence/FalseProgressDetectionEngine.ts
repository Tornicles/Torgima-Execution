/**
 * Prompt 7 §1.3 — false progress pattern detection (activity ≠ outcome movement).
 */

export const FALSE_PROGRESS_PATTERNS = [
  "ACTIVITY_WITHOUT_OUTCOME",
  "WRONG_WORK",
  "VANITY_PROGRESS",
  "REPEATED_COMPLETION_NO_RESULT",
  "CLAIM_CONTRADICTED",
  "AVOIDANCE_LOOP",
] as const;

export type FalseProgressPattern = (typeof FALSE_PROGRESS_PATTERNS)[number];

export type FalseProgressDetectionInput = {
  completionCount: number;
  evidenceScore: number;
  outcomeMovementScore: number;
  hasProof: boolean;
  avgScore: number;
  claimContradicted?: boolean;
  criticalBlockerOpen?: boolean;
  easyTaskOnly?: boolean;
};

export type FalseProgressDetectionResult = {
  detected: boolean;
  pattern: FalseProgressPattern | null;
  correctionTaskType: string;
};

export const CORRECTION_BY_PATTERN: Record<FalseProgressPattern, string> = {
  ACTIVITY_WITHOUT_OUTCOME: "root_cause_review",
  WRONG_WORK: "refocus_task",
  VANITY_PROGRESS: "target_clarification",
  REPEATED_COMPLETION_NO_RESULT: "task_value_review",
  CLAIM_CONTRADICTED: "evidence_submission",
  AVOIDANCE_LOOP: "dependency_resolution",
};

export function detectFalseProgress(
  input: FalseProgressDetectionInput,
): FalseProgressDetectionResult {
  const {
    completionCount,
    evidenceScore,
    outcomeMovementScore,
    hasProof,
    claimContradicted,
    criticalBlockerOpen,
    easyTaskOnly,
  } = input;

  if (claimContradicted) {
    return {
      detected: true,
      pattern: "CLAIM_CONTRADICTED",
      correctionTaskType: CORRECTION_BY_PATTERN.CLAIM_CONTRADICTED,
    };
  }

  if (
    evidenceScore < 20 &&
    outcomeMovementScore < 20 &&
    completionCount >= 5
  ) {
    return {
      detected: true,
      pattern: "ACTIVITY_WITHOUT_OUTCOME",
      correctionTaskType: CORRECTION_BY_PATTERN.ACTIVITY_WITHOUT_OUTCOME,
    };
  }

  if (completionCount >= 4 && outcomeMovementScore < 15 && evidenceScore < 30) {
    return {
      detected: true,
      pattern: "REPEATED_COMPLETION_NO_RESULT",
      correctionTaskType: CORRECTION_BY_PATTERN.REPEATED_COMPLETION_NO_RESULT,
    };
  }

  if (evidenceScore >= 40 && outcomeMovementScore < 15 && !hasProof) {
    return {
      detected: true,
      pattern: "VANITY_PROGRESS",
      correctionTaskType: CORRECTION_BY_PATTERN.VANITY_PROGRESS,
    };
  }

  if (criticalBlockerOpen && easyTaskOnly && completionCount >= 3) {
    return {
      detected: true,
      pattern: "AVOIDANCE_LOOP",
      correctionTaskType: CORRECTION_BY_PATTERN.AVOIDANCE_LOOP,
    };
  }

  return { detected: false, pattern: null, correctionTaskType: "clarification_task" };
}
