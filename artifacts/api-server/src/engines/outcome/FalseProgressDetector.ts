/**
 * DOC20 Task 4 — seven false progress patterns and correction responses.
 */

import { FALSE_PROGRESS_PATTERNS } from "../intelligence/FalseProgressDetectionEngine.js";
import type { ExecutionDataSnapshot, OutcomeScoringResult } from "./outcomeTypes.js";

export type FalseProgressPattern = (typeof FALSE_PROGRESS_PATTERNS)[number];

export type FalseProgressDetectionResult = {
  detected: boolean;
  pattern: FalseProgressPattern | null;
  patternsChecked: string[];
  correctionTaskType: string;
  responseEvents: string[];
  correctionPathId: string | null;
  falseProgressScore: number;
};

export const PATTERN_RESPONSES: Record<
  FalseProgressPattern,
  { correctionTaskType: string; responseEvents: string[] }
> = {
  ACTIVITY_WITHOUT_OUTCOME: {
    correctionTaskType: "refocus_task",
    responseEvents: ["priority_review_requested", "refocus_task_requested"],
  },
  WRONG_WORK: {
    correctionTaskType: "refocus_task",
    responseEvents: ["refocus_task_requested"],
  },
  PROOF_WEAK: {
    correctionTaskType: "evidence_submission",
    responseEvents: ["evidence_submission_task_requested"],
  },
  VANITY_PROGRESS: {
    correctionTaskType: "target_clarification",
    responseEvents: ["correction_task_requested"],
  },
  REPEATED_COMPLETION_NO_RESULT: {
    correctionTaskType: "root_cause_review",
    responseEvents: ["root_cause_review_requested"],
  },
  CLAIM_CONTRADICTED: {
    correctionTaskType: "clarification",
    responseEvents: ["correction_task_requested", "advancement_blocked"],
  },
  AVOIDANCE_LOOP: {
    correctionTaskType: "dependency_resolution",
    responseEvents: ["dependency_resolution_task_requested"],
  },
};

function buildResult(
  pattern: FalseProgressPattern,
  score: number,
): FalseProgressDetectionResult {
  const response = PATTERN_RESPONSES[pattern];
  return {
    detected: true,
    pattern,
    patternsChecked: [...FALSE_PROGRESS_PATTERNS],
    correctionTaskType: response.correctionTaskType,
    responseEvents: response.responseEvents,
    correctionPathId: `correction:${pattern.toLowerCase()}`,
    falseProgressScore: score,
  };
}

export class FalseProgressDetector {
  static detect(params: {
    scoring: OutcomeScoringResult;
    execution: ExecutionDataSnapshot;
    ledgerContradicted?: boolean;
    vanityMetricUntied?: boolean;
  }): FalseProgressDetectionResult {
    const { scoring, execution } = params;
    const none: FalseProgressDetectionResult = {
      detected: false,
      pattern: null,
      patternsChecked: [...FALSE_PROGRESS_PATTERNS],
      correctionTaskType: "clarification",
      responseEvents: [],
      correctionPathId: null,
      falseProgressScore: 0,
    };

    if (params.ledgerContradicted) {
      return buildResult("CLAIM_CONTRADICTED", 100);
    }

    if (execution.completedCount14d > 8 && scoring.outcomeMovementScore < 20) {
      return buildResult("ACTIVITY_WITHOUT_OUTCOME", 75);
    }

    if (scoring.alignmentScore < 30 && execution.completedCount14d >= 6) {
      return buildResult("WRONG_WORK", 65);
    }

    if (
      execution.hasClaim &&
      scoring.evidenceScore < 30 &&
      !execution.hasPaymentOrExternalProof
    ) {
      return buildResult("PROOF_WEAK", 55);
    }

    if (params.vanityMetricUntied) {
      return buildResult("VANITY_PROGRESS", 50);
    }

    if (
      (execution.repeatedSameTaskType ?? 0) >= 5 &&
      scoring.outcomeMovementScore < 20
    ) {
      return buildResult("REPEATED_COMPLETION_NO_RESULT", 60);
    }

    if (
      (execution.sequenceDependencyOpenDays ?? 0) > 7 &&
      execution.easyTaskOnly
    ) {
      return buildResult("AVOIDANCE_LOOP", 70);
    }

    if (scoring.alignmentScore < 30 && execution.completedCount14d > 5) {
      return buildResult("ACTIVITY_WITHOUT_OUTCOME", 45);
    }

    return none;
  }
}

export { FALSE_PROGRESS_PATTERNS };
