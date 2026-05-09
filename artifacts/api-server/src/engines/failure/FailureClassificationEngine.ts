import {
  db,
  orders,
  feedback,
  conditions,
  behaviorPatterns,
  decisionTraces,
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
  evidenceSummary:     string;
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
    return {
      primaryCategory:     "CLARITY_FAILURE",
      secondaryCategories: [],
      confidence:          "LOW",
      severity:            "LOW",
      repeatFailure:       false,
      correctionType:      "clarification_task_requested",
      evidenceSummary:     "Insufficient data to classify",
    };
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

  const blockerJson = fb.blocker_json as Record<string, unknown> | null;
  if (blockerKeys(blockerJson) > 0) {
    scores.DEPENDENCY_FAILURE = (scores.DEPENDENCY_FAILURE ?? 0) + 0.8;
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
    evidenceSummary: `${primaryCategory} detected with ${confidence} confidence`,
  };
}
