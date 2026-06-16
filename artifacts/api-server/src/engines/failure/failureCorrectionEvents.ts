/**
 * Phase 4 DOC 22 — emit primary correction events from classification result.
 * Delegates to CorrectionRouter (DOC22 Task 3).
 */

export {
  correctionTypeToTaskType,
  routeCorrection,
  emitFailureCorrectionEvents,
  CORRECTION_ROUTES,
} from "./CorrectionRouter.js";

import type { ClassificationResult } from "./FailureClassificationEngine.js";
import type { RepeatFailureResult } from "./RepeatFailureDetector.js";
import { routeCorrection } from "./CorrectionRouter.js";

/** Backward-compatible wrapper when routing was not done inside classifyFailure. */
export async function emitFailureCorrectionEventsFromResult(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  result: ClassificationResult;
}): Promise<void> {
  if (params.result.correctionRouted) return;

  const repeat: RepeatFailureResult = {
    repeatFailure: params.result.repeatFailure,
    sameCategoryCount7d: params.result.repeatFailure ? 2 : 0,
    sameOrderFailureCount: 0,
    proofRejectedCount: 0,
    forceClarityForSameOrder: false,
    escalateConfidence: false,
    escalateSeverity: params.result.repeatFailure,
    proofUxReviewRequired: false,
  };

  await routeCorrection({
    primaryCategory: params.result.primaryCategory,
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    feedbackId: params.feedbackId,
    severity: params.result.severity,
    repeat,
  });
}
