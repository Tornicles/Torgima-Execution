/**
 * DOC22 Task 1 — aggregate evidence for failure classification.
 */

import {
  db,
  orders,
  feedback,
  conditions,
  behaviorPatterns,
  capabilityProfiles,
  systemHealthLogs,
  taskGenerationLog,
  failureClassifications,
} from "@workspace/db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { getOpenFlags } from "../outcome/OutcomeValidationEngine.js";

export type FailureEvidence = {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  feedbackReflectionLength: number;
  reflection: string;
  completionStatus: string;
  score: number | null;
  frictionScore: number | null;
  confidenceScore: number | null;
  durationMinutes: number | null;
  gamingFlag: boolean;
  proofJson: unknown;
  validationStatus: string | null;
  rejectionReason: string | null;
  blockerJson: Record<string, unknown> | null;
  blockerCategory: string | undefined;
  orderDifficulty: string | null;
  orderTaskType: string | null;
  proofRequired: boolean;
  proofDescription: string | null;
  orderActionId: string | null;
  orderRegenerationCount: number;
  conditionName: string | null;
  consistency7d: number;
  difficultyHandling: string | null;
  hardFailures14d: number;
  activePatternTypes: string[];
  activeSpecLabels: string[];
  falseProgressScore: number;
  falseProgressFlagType: string | undefined;
  outcomeMovementScore: number;
  fatigueRiskPatternActive: boolean;
  taskTypeAvoidanceActive: boolean;
  stateIntegrityIssueRecent: boolean;
  summary: string;
};

function blockerCategoryFromJson(blocker: Record<string, unknown> | null): string | undefined {
  if (!blocker) return undefined;
  const raw =
    blocker.blocker_category ??
    blocker.category ??
    blocker.blocker_type ??
    blocker.type;
  return typeof raw === "string" ? raw.toUpperCase() : undefined;
}

export async function loadFailureEvidence(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
}): Promise<FailureEvidence | null> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  if (!order || !fb) return null;

  const [condition] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const patterns = await db
    .select({
      pattern_type: behaviorPatterns.pattern_type,
      evidence_json: behaviorPatterns.evidence_json,
    })
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, params.userId),
        eq(behaviorPatterns.blueprint_id, params.blueprintId),
        eq(behaviorPatterns.status, "active"),
      ),
    );

  const [capability] = await db
    .select({
      current_level: capabilityProfiles.current_level,
      consistency_score: capabilityProfiles.consistency_score,
      metadata: capabilityProfiles.metadata,
    })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const difficultyHandling =
    capability?.metadata && typeof capability.metadata === "object" && !Array.isArray(capability.metadata)
      ? String((capability.metadata as Record<string, unknown>).difficulty_handling ?? capability.current_level ?? "")
      : capability?.current_level ?? null;

  const since7 = new Date(Date.now() - 7 * 86400000);
  const since14 = new Date(Date.now() - 14 * 86400000);
  const since1h = new Date(Date.now() - 3600000);

  const recentFeedback = await db
    .select({ completion_status: feedback.completion_status, created_at: feedback.created_at })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since7),
      ),
    );

  const completed7d = recentFeedback.filter((r) => r.completion_status === "completed").length;
  const consistency7d =
    recentFeedback.length > 0 ? (completed7d / recentFeedback.length) * 100 : 0;

  const hardFailuresRows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since14),
        eq(feedback.completion_status, "failed"),
        sql`${orders.difficulty} in ('hard', 'very_hard')`,
      ),
    );

  const [{ regenCount = 0 } = {}] = order.action_id
    ? await db
        .select({ regenCount: count() })
        .from(taskGenerationLog)
        .where(
          and(
            eq(taskGenerationLog.blueprint_id, params.blueprintId),
            sql`${taskGenerationLog.input_json}->>'action_id' = ${order.action_id}`,
          ),
        )
    : [{ regenCount: 0 }];

  const [{ integrityIssues = 0 } = {}] = await db
    .select({ integrityIssues: count() })
    .from(systemHealthLogs)
    .where(
      and(
        eq(systemHealthLogs.blueprint_id, params.blueprintId),
        gte(systemHealthLogs.created_at, since1h),
        sql`${systemHealthLogs.area} in ('STATE_INTEGRITY', 'STATE_INTEGRITY')`,
      ),
    );

  const openFlags = await getOpenFlags(params.blueprintId);
  const falseProgressFlag = openFlags[0];
  const falseProgressScore = falseProgressFlag?.false_progress_score ?? 0;

  const activeSpecLabels = patterns
    .map((p) =>
      p.evidence_json && typeof p.evidence_json === "object" && !Array.isArray(p.evidence_json)
        ? String((p.evidence_json as Record<string, unknown>).spec_label ?? "")
        : "",
    )
    .filter(Boolean);

  const reflection = fb.reflection ?? "";
  const blockerJson = fb.blocker_json as Record<string, unknown> | null;
  const interrogation = fb.interrogation_json as Record<string, unknown> | null;
  const validationStatus =
    typeof interrogation?.validation_status === "string"
      ? interrogation.validation_status
      : fb.validity ?? null;
  const rejectionReason =
    typeof interrogation?.rejection_reason === "string"
      ? interrogation.rejection_reason
      : typeof fb.gaming_reason === "string"
        ? fb.gaming_reason
        : null;

  return {
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    feedbackId: params.feedbackId,
    feedbackReflectionLength: reflection.length,
    reflection,
    completionStatus: fb.completion_status,
    score: fb.score,
    frictionScore: fb.friction_score,
    confidenceScore: fb.confidence_score,
    durationMinutes: fb.duration_minutes,
    gamingFlag: fb.gaming_flag,
    proofJson: fb.proof_json,
    validationStatus,
    rejectionReason,
    blockerJson,
    blockerCategory: blockerCategoryFromJson(blockerJson),
    orderDifficulty: order.difficulty,
    orderTaskType: order.task_type,
    proofRequired: order.proof_required,
    proofDescription: order.proof_description,
    orderActionId: order.action_id,
    orderRegenerationCount: Number(regenCount),
    conditionName: condition?.condition ?? null,
    consistency7d,
    difficultyHandling,
    hardFailures14d: hardFailuresRows.length,
    activePatternTypes: patterns.map((p) => p.pattern_type),
    activeSpecLabels,
    falseProgressScore,
    falseProgressFlagType: falseProgressFlag?.detection_type,
    outcomeMovementScore: typeof fb.weighted_score === "number" ? fb.weighted_score : (fb.score ?? 0) * 10,
    fatigueRiskPatternActive: activeSpecLabels.includes("FATIGUE_RISK"),
    taskTypeAvoidanceActive:
      activeSpecLabels.includes("TASK_TYPE_AVOIDANCE") ||
      patterns.some((p) => p.pattern_type === "task_type_avoidance"),
    stateIntegrityIssueRecent: Number(integrityIssues) > 0,
    summary: `${fb.completion_status} on ${order.difficulty} ${order.task_type}`,
  };
}

export async function countProofRejectionsForOrder(orderId: string): Promise<number> {
  const rows = await db
    .select({ id: failureClassifications.id })
    .from(failureClassifications)
    .innerJoin(feedback, eq(failureClassifications.feedback_id, feedback.id))
    .where(
      and(
        eq(failureClassifications.order_id, orderId),
        sql`${feedback.validity} = 'rejected' OR ${feedback.gaming_flag} = true`,
      ),
    );
  return rows.length;
}
