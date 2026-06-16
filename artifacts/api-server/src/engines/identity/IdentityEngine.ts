/**
 * DOC18 — Identity Continuity and Transformation Engine facade.
 */

import { db, userIdentityStates, identityHistory, feedback } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import {
  evaluateIdentityStage,
  calculateStage,
  calculateRegressionRisk,
  type IdentityEvaluationResult,
} from "./IdentityStageEvaluator.js";
import { isVerifiedFeedbackEvidence } from "./TransformationEvidenceCollector.js";
import {
  buildIdentityPanelView,
  toDashboardIdentityFromPanel,
  customerLabelForStage,
} from "./IdentityPanelProjection.js";
import {
  DB_TO_IL1_STAGE,
  IL1_TO_DB_STAGE,
  il1FromDbStage,
  type DbIdentityStage,
  type Il1IdentityStage,
} from "./stageTypes.js";

export {
  DB_TO_IL1_STAGE,
  IL1_TO_DB_STAGE,
  type DbIdentityStage,
  type Il1IdentityStage,
  isVerifiedFeedbackEvidence,
  calculateStage,
  calculateRegressionRisk,
  customerLabelForStage,
};

export class IdentityContinuityEngine {
  calculateStage = calculateStage;
  calculateRegressionRisk = calculateRegressionRisk;

  async evaluate(input: {
    userId: string;
    blueprintId: string;
    sourceFeedbackId: string;
  }): Promise<{
    stage: Il1IdentityStage;
    dbStage: DbIdentityStage;
    changed: boolean;
    regressionRisk: string;
  }> {
    const result = await evaluateIdentityStage(input.userId, input.blueprintId, {
      trigger: "feedback",
      sourceFeedbackId: input.sourceFeedbackId,
    });
    return {
      stage: result.currentStage,
      dbStage: result.dbStage,
      changed: result.advanced,
      regressionRisk: result.regressionRisk,
    };
  }
}

export const identityContinuityEngine = new IdentityContinuityEngine();

export async function evaluateIdentity(params: {
  userId: string;
  blueprintId: string;
  windowDays?: number;
  reason?: string;
  sourceFeedbackId?: string;
}): Promise<{ stage: string; changed: boolean; regressionRisk: string; held?: boolean }> {
  if (params.sourceFeedbackId) {
    const r = await evaluateIdentityStage(params.userId, params.blueprintId, {
      trigger: params.reason ?? "identity_evaluation_requested",
      sourceFeedbackId: params.sourceFeedbackId,
    });
    return {
      stage: r.dbStage,
      changed: r.advanced,
      regressionRisk: r.regressionRisk,
      held: r.held,
    };
  }

  const windowDays = params.windowDays ?? 14;
  const since = new Date(Date.now() - windowDays * 86400000);
  const [latest] = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since),
        eq(feedback.validity, "valid"),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (!latest) {
    return { stage: "starting", changed: false, regressionRisk: "LOW" };
  }

  const r = await evaluateIdentityStage(params.userId, params.blueprintId, {
    trigger: params.reason ?? "identity_evaluation_requested",
    sourceFeedbackId: latest.id,
  });
  return {
    stage: r.dbStage,
    changed: r.advanced,
    regressionRisk: r.regressionRisk,
    held: r.held,
  };
}

export async function getIdentityHistory(userId: string, blueprintId: string, limit = 20) {
  return db
    .select()
    .from(identityHistory)
    .where(and(eq(identityHistory.user_id, userId), eq(identityHistory.blueprint_id, blueprintId)))
    .orderBy(desc(identityHistory.created_at))
    .limit(limit);
}

export async function getCurrentIdentityState(userId: string, blueprintId: string) {
  const [row] = await db
    .select()
    .from(userIdentityStates)
    .where(
      and(
        eq(userIdentityStates.user_id, userId),
        eq(userIdentityStates.blueprint_id, blueprintId),
        eq(userIdentityStates.is_current, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getIdentityPanelData(userId: string, blueprintId: string) {
  const row = await getCurrentIdentityState(userId, blueprintId);
  const panel = await buildIdentityPanelView({ userId, blueprintId, identityRow: row });
  const dashboard = toDashboardIdentityFromPanel(panel);
  const il1 = row ? il1FromDbStage(row.stage, row.regression_risk) : undefined;

  return {
    ...panel,
    ...dashboard,
    previousStage: row?.previous_stage
      ? customerLabelForStage(DB_TO_IL1_STAGE[row.previous_stage as DbIdentityStage] ?? "UNFORMED")
      : null,
    lastEvaluatedAt: row?.updated_at ?? row?.last_evidence_at ?? null,
    strongestDimension: "consistency",
    weakestDimension: "transformation",
    internalStage: il1,
  };
}

/** Legacy dashboard mapper — customer-facing labels only. */
export function toDashboardIdentity(
  row: Awaited<ReturnType<typeof getCurrentIdentityState>> | null,
) {
  if (!row) {
    return {
      stage: customerLabelForStage("UNFORMED"),
      stabilityScore: 0,
      regressionRisk: "LOW" as const,
      transformationScore: 0,
      continuityScore: 0,
    };
  }

  const il1 = il1FromDbStage(row.stage, row.regression_risk);
  return {
    stage: customerLabelForStage(il1),
    stabilityScore: row.stability_score ?? 0,
    regressionRisk: (row.regression_risk ?? "LOW") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    transformationScore: row.transformation_score ?? 0,
    continuityScore: row.continuity_score ?? 0,
  };
}

export { evaluateIdentityStage, type IdentityEvaluationResult };
