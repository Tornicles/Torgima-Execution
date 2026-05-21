import {
  db,
  decisionTraces,
  cognitiveLoadScores,
  orders,
  feedback,
  blueprints,
} from "@workspace/db";
import { and, count, eq, gte, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export const IL4_DECISION_TYPES = {
  CONTROL_OUTPUT: "CONTROL_OUTPUT",
  FAILURE_ROUTING: "FAILURE_ROUTING",
  PRIORITY_SELECTION: "PRIORITY_SELECTION",
  CONDITION_CHANGE: "CONDITION_CHANGE",
} as const;

export async function traceDecision(params: {
  blueprintId: string;
  userId: string;
  decisionType: string;
  contextType: string;
  contextId?: string;
  rationale: string;
  outcome: string;
  evidenceIds?: string[];
  alternatives?: string[];
  aiAssisted?: boolean;
  engineSource?: string;
  inputSummary?: string;
  outputSummary?: string;
  alternativesConsidered?: unknown[];
  stateVersion?: number;
}): Promise<string> {
  const [row] = await db
    .insert(decisionTraces)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      decision_type: params.decisionType,
      entity_type: params.contextType,
      entity_id: params.contextId,
      reasoning: params.rationale,
      engine: params.engineSource ?? "decision_trace_system",
      engine_source: params.engineSource ?? "decision_trace_system",
      input_summary: params.inputSummary,
      output_summary: params.outputSummary,
      alternatives_considered: params.alternativesConsidered ?? params.alternatives ?? [],
      state_version: params.stateVersion,
      inputs_json: {
        user_id: params.userId,
        evidence_ids: params.evidenceIds ?? [],
        alternatives: params.alternatives ?? [],
        ai_assisted: params.aiAssisted ?? false,
        input_summary: params.inputSummary,
      },
      outputs_json: { outcome: params.outcome, output_summary: params.outputSummary },
    })
    .returning({ id: decisionTraces.id });

  if (!row) throw new Error("Failed to write decision trace");

  logger.debug(
    { traceId: row.id, decisionType: params.decisionType, blueprintId: params.blueprintId },
    "[DecisionTrace] Recorded",
  );

  return row.id;
}

/** IL4 LAW 1 — immutable audit after ControlEngine enforcement package. */
export async function traceControlOutput(params: {
  blueprintId: string;
  userId: string;
  packageId: string;
  condition: string;
  signalMomentum?: number | null;
  taskMin: number;
  taskMax: number;
  difficultyCap: string;
  stateVersion?: number;
}): Promise<string> {
  const momentum = params.signalMomentum ?? 0;
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.CONTROL_OUTPUT,
    contextType: "enforcement_package",
    contextId: params.packageId,
    engineSource: "ControlEngine",
    inputSummary: `Condition: ${params.condition}. Signal momentum: ${momentum}.`,
    outputSummary: `task_limit: ${params.taskMin}-${params.taskMax}, difficulty_cap: ${params.difficultyCap}.`,
    rationale: `Condition ${params.condition} determines allowed behavior.`,
    outcome: `package:${params.packageId}`,
    stateVersion: params.stateVersion,
  });
}

export async function traceFailureRouting(params: {
  blueprintId: string;
  userId: string;
  feedbackId: string;
  primaryCategory: string;
  correctionTaskType: string;
  stateVersion?: number;
}): Promise<string> {
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.FAILURE_ROUTING,
    contextType: "feedback",
    contextId: params.feedbackId,
    engineSource: "FailureClassificationEngine",
    inputSummary: `feedback:${params.feedbackId}`,
    outputSummary: `classification:${params.primaryCategory}, correction:${params.correctionTaskType}`,
    rationale: `${params.primaryCategory} routed to ${params.correctionTaskType}`,
    outcome: params.correctionTaskType,
    stateVersion: params.stateVersion,
  });
}

export async function tracePrioritySelection(params: {
  blueprintId: string;
  userId: string;
  condition: string;
  selectedTaskType: string;
  selectedOrderId?: string;
  candidates: Array<{ task_type: string; score: number }>;
  stateVersion?: number;
}): Promise<string> {
  const alts = params.candidates.map((c) => `${c.task_type}:${c.score}`);
  return traceDecision({
    blueprintId: params.blueprintId,
    userId: params.userId,
    decisionType: IL4_DECISION_TYPES.PRIORITY_SELECTION,
    contextType: "order",
    contextId: params.selectedOrderId,
    engineSource: "PriorityEngine",
    inputSummary: `condition:${params.condition}, candidates:${params.candidates.length}`,
    outputSummary: `selected:${params.selectedTaskType}`,
    rationale: `Highest value score under condition ${params.condition}`,
    outcome: params.selectedTaskType,
    alternativesConsidered: params.candidates,
    alternatives: alts,
    stateVersion: params.stateVersion,
  });
}

export async function calculateCognitiveLoad(params: {
  blueprintId: string;
  userId: string;
}): Promise<{ loadScore: number; loadLevel: string; loadCategory: string }> {
  const last24h = new Date(Date.now() - 24 * 3600000);

  const [recentDecisions, recentFeedback, activeOrdersRows, recentTraces] = await Promise.all([
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
    db
      .select({ decision_type: decisionTraces.decision_type })
      .from(decisionTraces)
      .where(
        and(
          eq(decisionTraces.blueprint_id, params.blueprintId),
          gte(decisionTraces.created_at, last24h),
        ),
      )
      .limit(50),
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

  const loadCategory =
    loadScore >= 0.8
      ? "OVERLOAD"
      : loadScore >= 0.6
        ? "HIGH"
        : loadScore >= 0.4
          ? "MODERATE"
          : "LOW";

  const priorityTypes = recentTraces.filter(
    (t) => t.decision_type === IL4_DECISION_TYPES.PRIORITY_SELECTION,
  ).length;
  const reversalCount = Math.max(0, priorityTypes - 1);
  const ambiguousTypes = new Set<string>([
    IL4_DECISION_TYPES.FAILURE_ROUTING,
    IL4_DECISION_TYPES.PRIORITY_SELECTION,
  ]);
  const ambiguityFlags = recentTraces.filter((t) => ambiguousTypes.has(t.decision_type)).length;

  try {
    await db.insert(cognitiveLoadScores).values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      load_score: loadScore,
      active_tasks: activeOrders,
      choice_count: recentDecisionsCount,
      decision_latency_ms: null,
      reversal_count: reversalCount,
      ambiguity_flags: ambiguityFlags,
      load_category: loadCategory,
      complexity_level: loadLevel.toLowerCase(),
      recommendation: loadLevel === "CRITICAL" ? "reduce_load" : undefined,
    });
  } catch (err) {
    logger.warn({ err }, "[DecisionTrace] cognitive_load insert failed");
  }

  if (["HIGH", "CRITICAL"].includes(loadLevel)) {
    await writeEvent({
      eventType: EVENT_TYPES.COGNITIVE_LOAD_HIGH,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { load_level: loadLevel, load_score: loadScore, load_category: loadCategory },
      idempotencyKey: `cognitive_load:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    });
  }

  return { loadScore, loadLevel, loadCategory };
}

export async function getBlueprintStateVersion(blueprintId: string): Promise<number> {
  const [bp] = await db
    .select({ state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return bp?.state_version ?? 0;
}
