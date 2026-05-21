import {
  db,
  orders,
  feedback,
  conditions,
  behaviorPatterns,
  decisionTraces,
  capabilityProfiles,
} from "@workspace/db";
import { and, count, eq, gte, like } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { traceDecision } from "../decision-trace/DecisionTraceSystem.js";

export const FAILURE_CATEGORIES = [
  "CLARITY_FAILURE",
  "CAPABILITY_FAILURE",
  "CAPACITY_FAILURE",
  "DEPENDENCY_FAILURE",
  "MOTIVATION_FRICTION",
  "SYSTEM_FRICTION",
  "WRONG_PRIORITY",
  "OUTCOME_MISMATCH",
  "EXTERNAL_BLOCKER",
  "PROOF_FAILURE",
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export interface ClassificationResult {
  primaryCategory:     FailureCategory;
  secondaryCategories: FailureCategory[];
  confidence:          "LOW" | "MEDIUM" | "HIGH";
  severity:            "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  repeatFailure:       boolean;
  correctionType:      string;
  /** TaskGenerationEngine task_type (IL3). */
  correctionTaskType:  string;
  evidenceSummary:     string;
}

/** Maps engine correction routes to order task_type values. */
export function correctionTypeToTaskType(correctionType: string): string {
  if (
    correctionType.includes("clarification") ||
    correctionType.includes("evidence_clarification")
  ) {
    return "clarification";
  }
  if (correctionType.includes("academy")) return "academy";
  if (
    correctionType.includes("blocker") ||
    correctionType.includes("dependency") ||
    correctionType.includes("external_wait")
  ) {
    return "blocker_resolution";
  }
  if (correctionType.includes("review") || correctionType.includes("priority")) return "review";
  return "recovery";
}

export async function persistFailureClassificationOnFeedback(params: {
  feedbackId: string;
  primaryCategory: FailureCategory;
  correctionTaskType: string;
}): Promise<void> {
  await db
    .update(feedback)
    .set({
      failure_classification: params.primaryCategory,
      failure_correction_type: params.correctionTaskType,
    })
    .where(eq(feedback.id, params.feedbackId));
}

function blockerKeys(nonNull: unknown): number {
  if (nonNull && typeof nonNull === "object" && !Array.isArray(nonNull)) {
    return Object.keys(nonNull as Record<string, unknown>).length;
  }
  return 0;
}

export async function classifyFailure(params: {
  userId:      string;
  blueprintId: string;
  orderId:     string;
  feedbackId:  string;
}): Promise<ClassificationResult> {
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

  const [condition] = await db
    .select()
    .from(conditions)
    .where(
      and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)),
    )
    .limit(1);

  const patterns = await db
    .select()
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, params.userId),
        eq(behaviorPatterns.blueprint_id, params.blueprintId),
        eq(behaviorPatterns.status, "active"),
      ),
    );

  if (!order || !fb) {
    const correctionType = "clarification_task_requested";
    return {
      primaryCategory:     "CLARITY_FAILURE",
      secondaryCategories: [],
      confidence:          "LOW",
      severity:            "LOW",
      repeatFailure:       false,
      correctionType,
      correctionTaskType:  correctionTypeToTaskType(correctionType),
      evidenceSummary:     "Insufficient data to classify",
    };
  }

  const blockerJson = fb.blocker_json as Record<string, unknown> | null;
  const hadBlocker = blockerKeys(blockerJson) > 0;
  const blockerType =
    typeof blockerJson?.blocker_type === "string" ? blockerJson.blocker_type : undefined;

  if (hadBlocker) {
    const correctionType = "dependency_resolution_requested";
    return {
      primaryCategory:     "DEPENDENCY_FAILURE",
      secondaryCategories: [],
      confidence:          "HIGH",
      severity:            "MEDIUM",
      repeatFailure:       false,
      correctionType,
      correctionTaskType:  correctionTypeToTaskType(correctionType),
      evidenceSummary:     `Blocker reported${blockerType ? `: ${blockerType}` : ""}`,
    };
  }

  const [capability] = await db
    .select({
      current_difficulty: capabilityProfiles.current_difficulty,
      fatigue_risk: capabilityProfiles.fatigue_risk,
    })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  if (
    order.difficulty === "hard" &&
    capability?.current_difficulty === "easy" &&
    fb.completion_status === "failed"
  ) {
    const correctionType = "academy_task_requested";
    return buildClassifiedResult({
      primaryCategory: "CAPABILITY_FAILURE",
      correctionType,
      confidence: "HIGH",
      severity: "MEDIUM",
      repeatFailure: false,
      evidenceSummary: "Hard task failed while capability recommends easy difficulty",
      blueprintId: params.blueprintId,
      feedbackId: params.feedbackId,
      orderId: params.orderId,
      userId: params.userId,
    });
  }

  if ((fb.score ?? 10) <= 2 && !hadBlocker) {
    const correctionType = "clarification_task_requested";
    return buildClassifiedResult({
      primaryCategory: "CLARITY_FAILURE",
      correctionType,
      confidence: "HIGH",
      severity: "LOW",
      repeatFailure: false,
      evidenceSummary: "Very low score without blocker — clarity failure",
      blueprintId: params.blueprintId,
      feedbackId: params.feedbackId,
      orderId: params.orderId,
      userId: params.userId,
    });
  }

  if (
    capability &&
    (capability.fatigue_risk === "high" || capability.fatigue_risk === "critical")
  ) {
    const correctionType = "load_reduction_requested";
    return buildClassifiedResult({
      primaryCategory: "CAPACITY_FAILURE",
      correctionType,
      confidence: "MEDIUM",
      severity: "MEDIUM",
      repeatFailure: false,
      evidenceSummary: "Elevated fatigue risk — capacity reduction",
      blueprintId: params.blueprintId,
      feedbackId: params.feedbackId,
      orderId: params.orderId,
      userId: params.userId,
    });
  }

  const scores: Partial<Record<FailureCategory, number>> = {};

  const frictionScore = fb.friction_score ?? 0;
  const reflectionLength = (fb.reflection ?? "").length;
  if (frictionScore >= 3 || reflectionLength < 30) {
    scores.CLARITY_FAILURE = (scores.CLARITY_FAILURE ?? 0) + 0.4;
  }

  const diffOrder = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;
  const diffIdx = diffOrder.indexOf(
    (order.difficulty ?? "moderate") as (typeof diffOrder)[number],
  );
  if (fb.completion_status === "failed" && diffIdx >= 3) {
    scores.CAPABILITY_FAILURE = (scores.CAPABILITY_FAILURE ?? 0) + 0.7;
  }

  const duration = fb.duration_minutes ?? 0;
  const estimate = order.time_estimate_minutes ?? 30;
  if (duration > estimate * 2 && condition?.condition === "urgency") {
    scores.CAPACITY_FAILURE = (scores.CAPACITY_FAILURE ?? 0) + 0.5;
  }

  const reflectionLower = (fb.reflection ?? "").toLowerCase();
  if (
    reflectionLower.includes("external") ||
    reflectionLower.includes("waiting on") ||
    (reflectionLower.includes("blocked by") && reflectionLower.includes("vendor"))
  ) {
    scores.EXTERNAL_BLOCKER = (scores.EXTERNAL_BLOCKER ?? 0) + 0.45;
  }

  if (
    fb.completion_status === "failed" &&
    order.proof_required &&
    (!fb.proof_json || blockerKeys(fb.proof_json) === 0)
  ) {
    scores.PROOF_FAILURE = (scores.PROOF_FAILURE ?? 0) + 0.55;
  }

  if (
    reflectionLower.includes("wrong") ||
    reflectionLower.includes("mismatch") ||
    reflectionLower.includes("not what i expected")
  ) {
    scores.OUTCOME_MISMATCH = (scores.OUTCOME_MISMATCH ?? 0) + 0.4;
  }

  if (
    fb.completion_status === "failed" &&
    duration > 0 &&
    duration < Math.max(5, Math.floor(estimate * 0.25))
  ) {
    scores.WRONG_PRIORITY = (scores.WRONG_PRIORITY ?? 0) + 0.35;
  }

  if (
    fb.completion_status === "failed" &&
    (fb.confidence_score ?? 5) <= 3 &&
    (fb.friction_score ?? 0) <= 1.5
  ) {
    scores.MOTIVATION_FRICTION = (scores.MOTIVATION_FRICTION ?? 0) + 0.45;
  }

  if (fb.gaming_flag) {
    scores.SYSTEM_FRICTION = (scores.SYSTEM_FRICTION ?? 0) + 0.3;
  }

  if (patterns.some(p => p.pattern_type === "avoidance")) {
    scores.MOTIVATION_FRICTION = (scores.MOTIVATION_FRICTION ?? 0) + 0.25;
  }

  if (Object.keys(scores).length === 0) {
    scores.CLARITY_FAILURE = 0.3;
  }

  const sorted = Object.entries(scores).sort((a, b) => (b[1] as number) - (a[1] as number));
  const primaryCategory = sorted[0][0] as FailureCategory;
  const secondaryCategories = sorted.slice(1, 3).map(s => s[0] as FailureCategory);
  const topScore = sorted[0][1] as number;
  const confidence: ClassificationResult["confidence"] =
    topScore >= 0.7 ? "HIGH" : topScore >= 0.5 ? "MEDIUM" : "LOW";

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const [{ c: recentSameCategory }] = await db
    .select({ c: count() })
    .from(decisionTraces)
    .where(
      and(
        eq(decisionTraces.blueprint_id, params.blueprintId),
        eq(decisionTraces.decision_type, "failure_classification"),
        like(decisionTraces.reasoning, `%${primaryCategory}%`),
        gte(decisionTraces.created_at, weekAgo),
      ),
    );

  const repeatFailure = Number(recentSameCategory ?? 0) >= 2;
  const severity: ClassificationResult["severity"] =
    repeatFailure && confidence === "HIGH"
      ? "CRITICAL"
      : repeatFailure
        ? "HIGH"
        : confidence === "HIGH"
          ? "MEDIUM"
          : "LOW";

  const correctionMap: Record<FailureCategory, string> = {
    CLARITY_FAILURE:     "clarification_task_requested",
    CAPABILITY_FAILURE:  "academy_task_requested",
    CAPACITY_FAILURE:    "load_reduction_requested",
    DEPENDENCY_FAILURE:  "dependency_resolution_requested",
    MOTIVATION_FRICTION: "friction_adaptation_requested",
    SYSTEM_FRICTION:     "system_repair_requested",
    WRONG_PRIORITY:      "priority_review_requested",
    OUTCOME_MISMATCH:    "correction_task_requested",
    EXTERNAL_BLOCKER:    "external_wait_requested",
    PROOF_FAILURE:       "evidence_clarification_requested",
  };
  const correctionType = correctionMap[primaryCategory] ?? "clarification_task_requested";
  const correctionTaskType = correctionTypeToTaskType(correctionType);

  await traceDecision({
    blueprintId:  params.blueprintId,
    userId:       params.userId,
    decisionType: "failure_classification",
    contextType:  "FEEDBACK",
    contextId:    params.feedbackId,
    rationale:    `${primaryCategory} (confidence: ${confidence}, repeat: ${repeatFailure})`,
    outcome:      correctionType,
    evidenceIds:  [params.orderId, params.feedbackId],
  }).catch(() => null);

  logger.info(
    {
      blueprintId: params.blueprintId,
      primary:     primaryCategory,
      confidence,
      severity,
      correction:  correctionType,
    },
    "[FailureEngine] Classified",
  );

  return {
    primaryCategory,
    secondaryCategories,
    confidence,
    severity,
    repeatFailure,
    correctionType,
    correctionTaskType,
    evidenceSummary: `${primaryCategory} detected with ${confidence} confidence`,
  };
}

async function buildClassifiedResult(params: {
  primaryCategory: FailureCategory;
  correctionType: string;
  confidence: ClassificationResult["confidence"];
  severity: ClassificationResult["severity"];
  repeatFailure: boolean;
  evidenceSummary: string;
  blueprintId: string;
  feedbackId: string;
  orderId: string;
  userId: string;
}): Promise<ClassificationResult> {
  const correctionTaskType = correctionTypeToTaskType(params.correctionType);
  await traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: "failure_classification",
    contextType: "FEEDBACK",
    contextId: params.feedbackId,
    rationale: `${params.primaryCategory} (fast-path)`,
    outcome: params.correctionType,
    evidenceIds: [params.orderId, params.feedbackId],
  }).catch(() => null);

  return {
    primaryCategory: params.primaryCategory,
    secondaryCategories: [],
    confidence: params.confidence,
    severity: params.severity,
    repeatFailure: params.repeatFailure,
    correctionType: params.correctionType,
    correctionTaskType,
    evidenceSummary: params.evidenceSummary,
  };
}

/** IL3 — class wrapper for DOC_22 wiring. */
export class FailureClassificationEngine {
  async classify(params: {
    userId: string;
    blueprintId: string;
    orderId: string;
    feedbackId: string;
    hadBlocker?: boolean;
    blockerType?: string;
    completion?: string;
    score?: number;
  }): Promise<ClassificationResult> {
    return classifyFailure({
      userId: params.userId,
      blueprintId: params.blueprintId,
      orderId: params.orderId,
      feedbackId: params.feedbackId,
    });
  }
}

export const failureClassificationEngine = new FailureClassificationEngine();
