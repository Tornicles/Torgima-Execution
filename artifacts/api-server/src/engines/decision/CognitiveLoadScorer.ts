/**
 * DOC23 Task 2 — cognitive load scoring (0–100) and persistence.
 */

import {
  db,
  cognitiveLoadScores,
  decisionTraces,
  feedback,
  orders,
  conditions,
} from "@workspace/db";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { applySimplification } from "./SimplificationEngine.js";
import type {
  CognitiveLoadAssessment,
  CognitiveLoadInput,
  CognitiveLoadLevel,
} from "./decisionTypes.js";

const HARD_CONDITIONS = new Set(["danger", "urgency"]);
const COMPLEXITY_RANK: Record<string, number> = {
  very_easy: 1,
  easy: 2,
  moderate: 3,
  hard: 4,
  very_hard: 5,
};

export function scoreCognitiveLoad(input: CognitiveLoadInput): CognitiveLoadAssessment {
  let score = 0;

  score += Math.min(30, input.choiceCount * 3);
  score += Math.min(25, input.unresolvedDecisionCount * 5);
  score += Math.min(24, input.reversalCount * 8);
  score += Math.min(12, input.ambiguityCount * 4);

  if (input.frictionScoreAverage > 70) score += 9;
  if (input.condition && HARD_CONDITIONS.has(input.condition)) score += 5;
  if (input.taskComplexity === "very_hard") score += 5;

  score = Math.min(100, Math.max(0, score));

  const level: CognitiveLoadLevel =
    score >= 80 ? "CRITICAL"
    : score >= 60 ? "HIGH"
    : score >= 35 ? "MEDIUM"
    : "LOW";

  const recommendation =
    level === "CRITICAL" ? "single_action_only"
    : level === "HIGH" ? "clarify_before_execute"
    : level === "MEDIUM" ? "simplify_copy"
    : undefined;

  return { score, level, recommendation };
}

export async function gatherCognitiveLoadInput(params: {
  blueprintId: string;
  userId: string;
}): Promise<CognitiveLoadInput> {
  const last24h = new Date(Date.now() - 24 * 3600000);

  const [traces, feedbackRows, activeOrders, conditionRow] = await Promise.all([
    db
      .select({
        decision_type: decisionTraces.decision_type,
        alternatives_considered: decisionTraces.alternatives_considered,
        outputs_json: decisionTraces.outputs_json,
      })
      .from(decisionTraces)
      .where(
        and(
          eq(decisionTraces.blueprint_id, params.blueprintId),
          gte(decisionTraces.created_at, last24h),
        ),
      )
      .orderBy(desc(decisionTraces.created_at))
      .limit(100),
    db
      .select({ friction_score: feedback.friction_score })
      .from(feedback)
      .where(
        and(
          eq(feedback.blueprint_id, params.blueprintId),
          eq(feedback.user_id, params.userId),
          gte(feedback.created_at, last24h),
        ),
      ),
    db
      .select({ difficulty: orders.difficulty })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, params.blueprintId),
          eq(orders.user_id, params.userId),
          inArray(orders.status, ["pending", "active", "needs_feedback", "blocked"]),
        ),
      ),
    db
      .select({ condition: conditions.condition })
      .from(conditions)
      .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
      .limit(1),
  ]);

  const choiceCount = traces.length;
  const unresolvedDecisionCount = traces.filter((t) => {
    const alts = Array.isArray(t.alternatives_considered) ? t.alternatives_considered : [];
    const outputs =
      t.outputs_json && typeof t.outputs_json === "object" && !Array.isArray(t.outputs_json)
        ? (t.outputs_json as Record<string, unknown>)
        : {};
    return alts.length > 1 && !outputs.outcome && !outputs.output_summary;
  }).length;

  const priorityCount = traces.filter((t) => t.decision_type === "PRIORITY_SELECTION").length;
  const reversalCount = Math.max(0, priorityCount - 1);
  const ambiguityCount = traces.filter((t) =>
    ["FAILURE_ROUTING", "PRIORITY_SELECTION", "failure_classification"].includes(t.decision_type),
  ).length;

  const frictionScoreAverage =
    feedbackRows.length > 0
      ? (feedbackRows.reduce((s, f) => s + (f.friction_score ?? 0), 0) / feedbackRows.length) *
        20
      : 0;

  let taskComplexity: string | null = null;
  let maxRank = 0;
  for (const o of activeOrders) {
    const rank = COMPLEXITY_RANK[o.difficulty ?? "moderate"] ?? 3;
    if (rank > maxRank) {
      maxRank = rank;
      taskComplexity = o.difficulty ?? "moderate";
    }
  }

  return {
    choiceCount,
    unresolvedDecisionCount,
    reversalCount,
    ambiguityCount,
    frictionScoreAverage,
    condition: conditionRow[0]?.condition ?? null,
    taskComplexity,
  };
}

export async function evaluateAndPersistCognitiveLoad(params: {
  blueprintId: string;
  userId: string;
  enforcementTaskMin?: number;
}): Promise<CognitiveLoadAssessment> {
  const input = await gatherCognitiveLoadInput(params);
  const assessment = scoreCognitiveLoad(input);
  const activeTasks = await db
    .select({ c: count() })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, params.blueprintId),
        eq(orders.user_id, params.userId),
        inArray(orders.status, ["pending", "active"]),
      ),
    );

  try {
    await db.insert(cognitiveLoadScores).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      load_score: assessment.score / 100,
      active_tasks: Number(activeTasks[0]?.c ?? 0),
      choice_count: input.choiceCount,
      reversal_count: input.reversalCount,
      ambiguity_flags: input.ambiguityCount,
      load_category: assessment.level,
      complexity_level: assessment.level.toLowerCase(),
      recommendation: assessment.recommendation,
    });
  } catch (err) {
    logger.warn({ err }, "[CognitiveLoadScorer] insert failed");
  }

  if (assessment.level === "HIGH" || assessment.level === "CRITICAL") {
    await writeEvent({
      eventType: EVENT_TYPES.COGNITIVE_LOAD_HIGH,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: {
        load_level: assessment.level,
        load_score: assessment.score,
        recommendation: assessment.recommendation,
      },
      idempotencyKey: `cognitive_load:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);

    await applySimplification({
      userId: params.userId,
      blueprintId: params.blueprintId,
      loadLevel: assessment.level,
      loadScore: assessment.score,
      enforcementTaskMin: params.enforcementTaskMin ?? 1,
    });
  }

  return assessment;
}
