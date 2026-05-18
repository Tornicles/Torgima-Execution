/**
 * Prompt 7 §5 — Persist multi-hypothesis failure classifications.
 */
import { db, failureClassifications } from "@workspace/db";
import {
  classifyFailure,
  type ClassificationResult,
  FAILURE_CATEGORIES,
} from "./FailureClassificationEngine.js";
import { routeTrigger } from "../../bhudhi/TriggerRouter.js";
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
  const reflection = params.reflection ?? "";

  const bhudhi = await routeTrigger({
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    feedbackId: params.feedbackId,
    triggerType: "ROOT_CAUSE_ASSIST",
    payload: { reflection, primaryCategory: base.primaryCategory },
    worldStateVersion: 0,
    currentCondition: "stability",
    priority: "MEDIUM",
  }).catch(() => null);

  const candidates =
    (bhudhi?.contextPacket as { data?: { candidates?: Array<{ category: string; likelihood: number }> } })
      ?.data?.candidates ?? [];

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

  const [record] = await db
    .insert(failureClassifications)
    .values({
      user_id: params.userId,
      order_id: params.orderId,
      feedback_id: params.feedbackId,
      primary_candidate: primary,
      primary_likelihood: primaryLikelihood,
      secondary_candidate: secondary,
      secondary_likelihood: Math.max(0.1, primaryLikelihood - 0.2),
      tertiary_candidate: tertiary,
      tertiary_likelihood: Math.max(0.05, primaryLikelihood - 0.35),
      evidence_citations: [{ source: "reflection", excerpt: reflection.slice(0, 200) }],
      system_action: systemAction,
    })
    .returning();

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
