/**
 * Prompt 7 §5 — Persist multi-hypothesis failure classifications.
 */
import { db, failureClassifications, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  classifyFailure,
  persistFailureClassificationOnFeedback,
  type ClassificationResult,
  FAILURE_CATEGORIES,
} from "./FailureClassificationEngine.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { runDebate } from "../../bhudhi/DebateEngine.js";

const PROMPT7_CATEGORIES = [
  "CONSISTENCY_FAILURE",
  "STRATEGY_FAILURE",
  "TECHNICAL_FAILURE",
  "CAPABILITY_GAP",
  "RESOURCE_CONSTRAINT",
  "MOTIVATION_COLLAPSE",
  "EXTERNAL_BLOCKER",
  "SCOPE_MISALIGNMENT",
  "OVERLOAD",
] as const;

function safeLikelihood(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function mapToPrompt7Category(primary: string, reflection: string): string {
  const r = reflection.toLowerCase();
  if (r.includes("don't know how") || r.includes("dont know how")) return "CAPABILITY_GAP";
  if (primary === "CAPABILITY_FAILURE") return "CAPABILITY_GAP";
  if (primary === "MOTIVATION_FRICTION") return "MOTIVATION_COLLAPSE";
  if (primary === "CAPACITY_FAILURE") return "OVERLOAD";
  if (primary === "DEPENDENCY_FAILURE") return "EXTERNAL_BLOCKER";
  if (primary === "CLARITY_FAILURE") return "SCOPE_MISALIGNMENT";
  if (primary === "EXTERNAL_BLOCKER") return "EXTERNAL_BLOCKER";
  if (primary === "WRONG_PRIORITY") return "STRATEGY_FAILURE";
  return "CONSISTENCY_FAILURE";
}

function systemActionFor(candidate: string): string {
  if (candidate === "CAPABILITY_GAP") return "academy_task_requested";
  if (candidate === "MOTIVATION_COLLAPSE") return "meaning_reconnect_task";
  if (candidate === "EXTERNAL_BLOCKER") return "blocker_resolution_task";
  return "recovery_task_requested";
}

export async function classifyFailureWithRecord(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  feedbackId: string;
  reflection?: string;
}) {
  const base = await classifyFailure(params);
  await persistFailureClassificationOnFeedback({
    feedbackId: params.feedbackId,
    primaryCategory: base.primaryCategory,
    correctionTaskType: base.correctionTaskType,
  });

  const { traceFailureRouting, getBlueprintStateVersion } = await import(
    "../decision-trace/DecisionTraceSystem.js"
  );
  await traceFailureRouting({
    blueprintId: params.blueprintId,
    userId: params.userId,
    feedbackId: params.feedbackId,
    primaryCategory: base.primaryCategory,
    correctionTaskType: base.correctionTaskType,
    stateVersion: await getBlueprintStateVersion(params.blueprintId),
  });

  await writeEvent({
    eventType: EVENT_TYPES.FAILURE_CLASSIFIED,
    entityType: "feedback",
    entityId: params.feedbackId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      primary_category: base.primaryCategory,
      correction_task_type: base.correctionTaskType,
      correction_type: base.correctionType,
    },
    idempotencyKey: `failure_classified:${params.feedbackId}`,
  });

  const reflection = params.reflection ?? "";

  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const bhudhi = await routeBhudhiRequest({
    sourceEngine: "FAILURE_CLASSIFICATION",
    triggerType: "ROOT_CAUSE_ASSIST",
    requestedMode: "INTERPRET",
    userId: params.userId,
    blueprintId: params.blueprintId,
    stateVersion: bp?.state_version ?? 0,
    idempotencyKey: `root_cause:${params.feedbackId}`,
    facts: {
      reflection,
      primaryCategory: base.primaryCategory,
      failureContext: reflection.slice(0, 500),
    },
  }).catch(() => null);

  const candidates =
    (bhudhi?.output?.data as { candidates?: Array<{ category: string; likelihood: number }> } | undefined)
      ?.candidates ?? [];

  let primary = mapToPrompt7Category(base.primaryCategory, reflection);
  let primaryLikelihood =
    base.confidence === "HIGH" ? 0.75 : base.confidence === "MEDIUM" ? 0.55 : 0.45;

  if (candidates.length >= 1) {
    primary = candidates[0]!.category;
    primaryLikelihood = candidates[0]!.likelihood;
  }

  let secondary = base.secondaryCategories[0]
    ? mapToPrompt7Category(base.secondaryCategories[0], reflection)
    : PROMPT7_CATEGORIES[2];
  let tertiary = base.secondaryCategories[1]
    ? mapToPrompt7Category(base.secondaryCategories[1], reflection)
    : PROMPT7_CATEGORIES[8];

  if (primaryLikelihood < 0.6) {
    await runDebate({
      userId: params.userId,
      topic: `failure_classification:${params.feedbackId}`,
      triggerType: "ROOT_CAUSE_ASSIST",
      debateType: "FAILURE_CLASSIFICATION",
      contextPacket: { primary, reflection, categories: PROMPT7_CATEGORIES },
      feasibilityScore: primaryLikelihood,
    }).catch(() => null);
    primaryLikelihood = Math.min(0.65, primaryLikelihood + 0.1);
  }

  const systemAction = systemActionFor(primary);

  let record: (typeof failureClassifications.$inferSelect) | undefined;
  try {
    const [row] = await db
      .insert(failureClassifications)
      .values({
        user_id: params.userId,
        order_id: params.orderId,
        feedback_id: params.feedbackId,
        primary_candidate: primary,
        primary_likelihood: primaryLikelihood,
        secondary_candidate: secondary,
      secondary_likelihood: safeLikelihood(primaryLikelihood - 0.2, 0.35),
      tertiary_candidate: tertiary,
      tertiary_likelihood: safeLikelihood(primaryLikelihood - 0.35, 0.2),
        evidence_citations: [{ source: "reflection", excerpt: reflection.slice(0, 200) }],
        system_action: systemAction,
      })
      .returning();
    record = row;
  } catch (err) {
    const { logger } = await import("../../lib/logger.js");
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), feedbackId: params.feedbackId },
      "[FailureClassificationRecord] Insert failed",
    );
  }

  if (primary === "CAPABILITY_GAP") {
    const { routeCapabilityGapToAcademy } = await import("../academy/AcademyOrchestrator.js");
    await routeCapabilityGapToAcademy({
      userId: params.userId,
      blueprintId: params.blueprintId,
      orderId: params.orderId,
      failureCategory: primary,
      reflection,
    }).catch(() => null);
  }

  return { ...base, record, primaryCandidate: primary, systemAction };
}

export { FAILURE_CATEGORIES, type ClassificationResult };
