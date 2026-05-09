import {
  db,
  decisionTraces,
  cognitiveLoadScores,
  orders,
  feedback,
} from "@workspace/db";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export async function traceDecision(params: {
  blueprintId:  string;
  userId:       string;
  decisionType: string;
  contextType:  string;
  contextId?:   string;
  rationale:    string;
  outcome:      string;
  evidenceIds?: string[];
  alternatives?: string[];
  aiAssisted?:  boolean;
}): Promise<string> {
  const [row] = await db
    .insert(decisionTraces)
    .values({
      blueprint_id: params.blueprintId,
      decision_type: params.decisionType,
      entity_type: params.contextType,
      entity_id: params.contextId,
      reasoning: params.rationale,
      engine: "decision_trace_system",
      inputs_json: {
        user_id:      params.userId,
        evidence_ids: params.evidenceIds ?? [],
        alternatives: params.alternatives ?? [],
        ai_assisted:  params.aiAssisted ?? false,
      },
      outputs_json: { outcome: params.outcome },
    })
    .returning({ id: decisionTraces.id });

  if (!row) throw new Error("Failed to write decision trace");

  logger.debug(
    { traceId: row.id, decisionType: params.decisionType, blueprintId: params.blueprintId },
    "[DecisionTrace] Recorded",
  );

  return row.id;
}

export async function calculateCognitiveLoad(params: {
  blueprintId: string;
  userId:      string;
}): Promise<{ loadScore: number; loadLevel: string }> {
  const last24h = new Date(Date.now() - 24 * 3600000);

  const [recentDecisions, recentFeedback, activeOrdersRows] = await Promise.all([
    db
      .select({ c: count() })
      .from(decisionTraces)
      .where(
        and(
          eq(decisionTraces.blueprint_id, params.blueprintId),
          gte(decisionTraces.created_at, last24h),
        ),
      ),
    db
      .select({
        friction_score: feedback.friction_score,
        confidence_score: feedback.confidence_score,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.blueprint_id, params.blueprintId),
          eq(feedback.user_id, params.userId),
          gte(feedback.created_at, last24h),
        ),
      ),
    db
      .select({ c: count() })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, params.blueprintId),
          eq(orders.user_id, params.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      ),
  ]);

  const recentDecisionsCount = Number(recentDecisions[0]?.c ?? 0);
  const activeOrders = Number(activeOrdersRows[0]?.c ?? 0);

  const rf = recentFeedback;
  const avgFriction =
    rf.length > 0
      ? rf.reduce((s, f) => s + (f.friction_score ?? 0), 0) / rf.length / 5
      : 0;
  const avgConfidence =
    rf.length > 0
      ? 1 -
        rf.reduce((s, f) => s + (f.confidence_score ?? 5), 0) / rf.length / 5
      : 0;

  const loadScore = Math.min(
    1.0,
    (recentDecisionsCount / 20) * 0.3 +
      (activeOrders / 5) * 0.3 +
      avgFriction * 0.2 +
      avgConfidence * 0.2,
  );

  const loadLevel =
    loadScore >= 0.8
      ? "CRITICAL"
      : loadScore >= 0.6
        ? "HIGH"
        : loadScore >= 0.4
          ? "MEDIUM"
          : "LOW";

  try {
    await db.insert(cognitiveLoadScores).values({
      blueprint_id:     params.blueprintId,
      user_id:          params.userId,
      load_score:       loadScore,
      active_tasks:     activeOrders,
      complexity_level: loadLevel.toLowerCase(),
      recommendation: loadLevel === "CRITICAL" ? "reduce_load" : undefined,
    });
  } catch (err) {
    logger.warn({ err }, "[DecisionTrace] cognitive_load insert failed");
  }

  if (["HIGH", "CRITICAL"].includes(loadLevel)) {
    await writeEvent({
      eventType:      EVENT_TYPES.COGNITIVE_LOAD_HIGH,
      entityType:     "blueprint",
      entityId:       params.blueprintId,
      userId:         params.userId,
      blueprintId:    params.blueprintId,
      payload:        { load_level: loadLevel, load_score: loadScore },
      idempotencyKey: `cognitive_load:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
  }

  return { loadScore, loadLevel };
}
