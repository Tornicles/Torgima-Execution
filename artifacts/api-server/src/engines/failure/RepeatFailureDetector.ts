/**
 * DOC22 Task 4 — repeat failure detection and escalation rules.
 */

import { db, decisionTraces, feedback } from "@workspace/db";
import { and, count, eq, gte, like } from "drizzle-orm";
import type { FailureCategory } from "./failureTypes.js";
import { countProofRejectionsForOrder } from "./FailureEvidence.js";

export type RepeatFailureResult = {
  repeatFailure: boolean;
  sameCategoryCount7d: number;
  sameOrderFailureCount: number;
  proofRejectedCount: number;
  forceClarityForSameOrder: boolean;
  escalateConfidence: boolean;
  escalateSeverity: boolean;
  proofUxReviewRequired: boolean;
};

export async function checkRepeatFailure(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  primaryCategory: FailureCategory;
}): Promise<RepeatFailureResult> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [{ sameCategoryCount7d = 0 } = {}] = await db
    .select({ sameCategoryCount7d: count() })
    .from(decisionTraces)
    .where(
      and(
        eq(decisionTraces.blueprint_id, params.blueprintId),
        eq(decisionTraces.decision_type, "failure_classification"),
        like(decisionTraces.reasoning, `%${params.primaryCategory}%`),
        gte(decisionTraces.created_at, weekAgo),
      ),
    );

  const [{ sameOrderFailureCount = 0 } = {}] = await db
    .select({ sameOrderFailureCount: count() })
    .from(feedback)
    .where(
      and(
        eq(feedback.order_id, params.orderId),
        eq(feedback.user_id, params.userId),
        gte(feedback.created_at, weekAgo),
        eq(feedback.completion_status, "failed"),
      ),
    );

  const proofRejectedCount = await countProofRejectionsForOrder(params.orderId);

  const repeatByCategory = Number(sameCategoryCount7d) >= 2;
  const sameOrderTwice = Number(sameOrderFailureCount) >= 2;
  const proofUxReviewRequired = proofRejectedCount >= 3;

  return {
    repeatFailure: repeatByCategory || sameOrderTwice,
    sameCategoryCount7d: Number(sameCategoryCount7d),
    sameOrderFailureCount: Number(sameOrderFailureCount),
    proofRejectedCount,
    forceClarityForSameOrder: sameOrderTwice,
    escalateConfidence: repeatByCategory,
    escalateSeverity: repeatByCategory || sameOrderTwice,
    proofUxReviewRequired,
  };
}