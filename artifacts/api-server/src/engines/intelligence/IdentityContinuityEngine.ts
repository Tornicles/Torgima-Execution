/**
 * IL1 / DOC_18 — Identity Continuity Engine (verified execution evidence only).
 */

import {
  db,
  feedback,
  userIdentityStates,
  identityHistory,
  falseProgressFlags,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

/** IL1 public stage names (DOC_18). */
export type Il1IdentityStage =
  | "UNFORMED"
  | "INITIATING"
  | "BUILDING"
  | "STABILIZING"
  | "EXPANDING"
  | "INTEGRATED"
  | "REGRESSING"
  | "RESTARTING";

/** Postgres identity_stage enum values. */
export type DbIdentityStage =
  | "starting"
  | "forming"
  | "building"
  | "establishing"
  | "consolidated"
  | "transforming";

export const IL1_TO_DB_STAGE: Record<Il1IdentityStage, DbIdentityStage> = {
  UNFORMED: "starting",
  INITIATING: "forming",
  BUILDING: "building",
  STABILIZING: "establishing",
  EXPANDING: "consolidated",
  INTEGRATED: "transforming",
  REGRESSING: "forming",
  RESTARTING: "starting",
};

export const DB_TO_IL1_STAGE: Record<DbIdentityStage, Il1IdentityStage> = {
  starting: "UNFORMED",
  forming: "INITIATING",
  building: "BUILDING",
  establishing: "STABILIZING",
  consolidated: "EXPANDING",
  transforming: "INTEGRATED",
};

type FeedbackRow = typeof feedback.$inferSelect;

export function isVerifiedFeedbackEvidence(row: FeedbackRow): boolean {
  if (row.validity !== "valid") return false;
  if (row.gaming_flag) return false;
  const interrogation = row.interrogation_json as { status?: string } | null;
  if (interrogation?.status === "pending" || interrogation?.status === "needs_interrogation") {
    return false;
  }
  if (row.confidence_score != null && row.confidence_score < 0.35) return false;
  return true;
}

export class IdentityContinuityEngine {
  calculateStage(
    consistency: number,
    avgScore: number,
    count: number,
    current?: string | null,
  ): Il1IdentityStage {
    if (count < 3) return "INITIATING";
    if (consistency < 0.3) return "REGRESSING";
    if (consistency >= 0.8 && avgScore >= 7 && count >= 20) return "INTEGRATED";
    if (consistency >= 0.75 && avgScore >= 6.5) return "EXPANDING";
    if (consistency >= 0.65 && avgScore >= 6) return "STABILIZING";
    if (consistency >= 0.5 && count >= 7) return "BUILDING";
    if (current && DB_TO_IL1_STAGE[current as DbIdentityStage]) {
      return DB_TO_IL1_STAGE[current as DbIdentityStage];
    }
    return "INITIATING";
  }

  calculateRegressionRisk(consistency: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (consistency < 0.2) return "CRITICAL";
    if (consistency < 0.4) return "HIGH";
    if (consistency < 0.6) return "MEDIUM";
    return "LOW";
  }

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
    const twoWeeks = new Date(Date.now() - 14 * 86400000);

    const rows = await db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.user_id, input.userId),
          eq(feedback.blueprint_id, input.blueprintId),
          gte(feedback.created_at, twoWeeks),
        ),
      )
      .orderBy(desc(feedback.created_at));

    const evidence = rows.filter(isVerifiedFeedbackEvidence);
    const completedCount = evidence.filter((f) => f.completion_status === "completed").length;
    const totalCount = evidence.length;
    const consistencyScore = totalCount > 0 ? completedCount / totalCount : 0;
    const avgScore =
      totalCount > 0
        ? evidence.reduce((s, f) => s + (f.weighted_score ?? f.score ?? 0), 0) / totalCount
        : 0;

    const [currentState] = await db
      .select()
      .from(userIdentityStates)
      .where(
        and(
          eq(userIdentityStates.user_id, input.userId),
          eq(userIdentityStates.blueprint_id, input.blueprintId),
          eq(userIdentityStates.is_current, true),
        ),
      )
      .limit(1);

    let il1Stage = this.calculateStage(
      consistencyScore,
      avgScore,
      totalCount,
      currentState?.stage,
    );

    const [blockingFp] = await db
      .select({ severity: falseProgressFlags.severity })
      .from(falseProgressFlags)
      .where(
        and(
          eq(falseProgressFlags.blueprint_id, input.blueprintId),
          eq(falseProgressFlags.resolved, false),
        ),
      )
      .limit(1);

    const fpSeverity = (blockingFp?.severity ?? "").toLowerCase();
    if (blockingFp && ["medium", "high", "critical"].includes(fpSeverity)) {
      const currentIl1 =
        currentState?.stage != null
          ? DB_TO_IL1_STAGE[currentState.stage as DbIdentityStage]
          : il1Stage;
      const stageOrder: Il1IdentityStage[] = [
        "UNFORMED",
        "INITIATING",
        "BUILDING",
        "STABILIZING",
        "EXPANDING",
        "INTEGRATED",
      ];
      const curIdx = stageOrder.indexOf(currentIl1);
      const nextIdx = stageOrder.indexOf(il1Stage);
      if (nextIdx > curIdx) {
        il1Stage = currentIl1;
      }
    }

    const dbStage = IL1_TO_DB_STAGE[il1Stage];
    const regressionRisk = this.calculateRegressionRisk(consistencyScore);
    const stabilityScore = consistencyScore * 100;
    const continuityScore = stabilityScore;
    const transformationScore = (avgScore / 10) * 100;
    const previousDbStage = currentState?.stage ?? "starting";
    const changed = previousDbStage !== dbStage;

    await db.transaction(async (tx) => {
      if (currentState) {
        await tx
          .update(userIdentityStates)
          .set({ is_current: false })
          .where(eq(userIdentityStates.id, currentState.id));
      }

      await tx.insert(userIdentityStates).values({
        user_id: input.userId,
        blueprint_id: input.blueprintId,
        stage: dbStage,
        previous_stage: previousDbStage,
        stability_score: stabilityScore,
        continuity_score: continuityScore,
        transformation_score: transformationScore,
        regression_risk: regressionRisk,
        evidence_count: totalCount,
        last_evidence_at: new Date(),
        last_reinforced_at: new Date(),
        reinforcement_count: (currentState?.reinforcement_count ?? 0) + 1,
        is_current: true,
      });

      if (changed) {
        await tx.insert(identityHistory).values({
          user_id: input.userId,
          blueprint_id: input.blueprintId,
          trigger: "feedback",
          stage_before: previousDbStage,
          stage_after: dbStage,
          transformation_score: transformationScore,
          snapshot: {
            il1_stage: il1Stage,
            stability_score: stabilityScore,
            continuity_score: continuityScore,
            regression_risk: regressionRisk,
            evidence_summary: `${completedCount}/${totalCount} completed in 14d`,
            source_feedback_id: input.sourceFeedbackId,
          },
        });
      }
    });

    const [openFalseProgress] = await db
      .select({ id: falseProgressFlags.id })
      .from(falseProgressFlags)
      .where(
        and(
          eq(falseProgressFlags.blueprint_id, input.blueprintId),
          eq(falseProgressFlags.resolved, false),
        ),
      )
      .limit(1);

    if (openFalseProgress && il1Stage !== "REGRESSING") {
      logger.info(
        { blueprintId: input.blueprintId },
        "[IdentityContinuityEngine] False progress open — stage held",
      );
    }

    logger.info(
      {
        userId: input.userId,
        blueprintId: input.blueprintId,
        il1Stage,
        dbStage,
        changed,
        regressionRisk,
        evidenceCount: totalCount,
      },
      "[IdentityContinuityEngine] evaluate complete",
    );

    return { stage: il1Stage, dbStage, changed, regressionRisk };
  }
}

export const identityContinuityEngine = new IdentityContinuityEngine();

/** Back-compat entry used by IdentityWorker when no feedback id is present. */
export async function evaluateIdentity(params: {
  userId: string;
  blueprintId: string;
  windowDays?: number;
  reason?: string;
  sourceFeedbackId?: string;
}): Promise<{ stage: string; changed: boolean; regressionRisk: string }> {
  if (params.sourceFeedbackId) {
    const r = await identityContinuityEngine.evaluate({
      userId: params.userId,
      blueprintId: params.blueprintId,
      sourceFeedbackId: params.sourceFeedbackId,
    });
    return { stage: r.dbStage, changed: r.changed, regressionRisk: r.regressionRisk };
  }

  const twoWeeks = new Date(Date.now() - (params.windowDays ?? 14) * 86400000);
  const [latest] = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, twoWeeks),
        eq(feedback.validity, "valid"),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (!latest) {
    return { stage: "starting", changed: false, regressionRisk: "LOW" };
  }

  const r = await identityContinuityEngine.evaluate({
    userId: params.userId,
    blueprintId: params.blueprintId,
    sourceFeedbackId: latest.id,
  });
  return { stage: r.dbStage, changed: r.changed, regressionRisk: r.regressionRisk };
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

/** Dashboard-safe identity panel (no raw evidence IDs). */
export async function getIdentityPanelData(userId: string, blueprintId: string) {
  const row = await getCurrentIdentityState(userId, blueprintId);
  const panel = toDashboardIdentity(row);
  const previousIl1 =
    row?.previous_stage != null
      ? DB_TO_IL1_STAGE[row.previous_stage as DbIdentityStage]
      : null;
  const scores = [panel.stabilityScore, panel.continuityScore, panel.transformationScore];
  const dims = ["stability", "continuity", "transformation"] as const;
  const maxIdx = scores.indexOf(Math.max(...scores));
  const minIdx = scores.indexOf(Math.min(...scores));
  return {
    ...panel,
    previousStage: previousIl1,
    lastEvaluatedAt: row?.updated_at ?? row?.last_evidence_at ?? null,
    strongestDimension: dims[maxIdx] ?? "stability",
    weakestDimension: dims[minIdx] ?? "transformation",
  };
}

export function toDashboardIdentity(
  row: Awaited<ReturnType<typeof getCurrentIdentityState>> | null,
) {
  if (!row) {
    return {
      stage: "UNFORMED" as Il1IdentityStage,
      stabilityScore: 0,
      regressionRisk: "LOW" as const,
      transformationScore: 0,
      continuityScore: 0,
    };
  }
  const dbStage = row.stage as DbIdentityStage;
  const il1 =
    row.regression_risk === "HIGH" || row.regression_risk === "CRITICAL"
      ? ("REGRESSING" as Il1IdentityStage)
      : DB_TO_IL1_STAGE[dbStage] ?? "INITIATING";
  return {
    stage: il1,
    stabilityScore: row.stability_score ?? 0,
    regressionRisk: (row.regression_risk ?? "LOW") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    transformationScore: row.transformation_score ?? 0,
    continuityScore: row.continuity_score ?? 0,
  };
}
