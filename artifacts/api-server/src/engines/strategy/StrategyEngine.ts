import {
  db,
  blueprints,
  conditions,
  pivotReviews,
  feedback,
  orders,
  signalSnapshots,
  stateMemory,
} from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { CONDITIONS } from "../../constants/conditions.js";

const NOTHINGNESS = CONDITIONS.NOTHINGNESS;

export async function evaluatePivotEligibility(params: {
  blueprintId: string;
  userId: string;
  triggerType: "automatic" | "manual";
}): Promise<{ eligible: boolean; blockedReason?: string }> {
  const [blueprint] = await db
    .select({ id: blueprints.id, status: blueprints.status })
    .from(blueprints)
    .where(
      and(
        eq(blueprints.id, params.blueprintId),
        eq(blueprints.user_id, params.userId),
        eq(blueprints.active, true),
      ),
    )
    .limit(1);

  if (!blueprint || blueprint.status !== BlueprintStatus.ACTIVE) {
    return { eligible: false, blockedReason: "Blueprint not active" };
  }

  const [conditionRow] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  if (!conditionRow || conditionRow.condition === NOTHINGNESS) {
    return {
      eligible: false,
      blockedReason: "Insufficient execution data for a directional recommendation",
    };
  }

  if (conditionRow.condition === "danger" && params.triggerType === "automatic") {
    const [{ recoveryCount }] = await db
      .select({ recoveryCount: sql<number>`count(*)::int` })
      .from(feedback)
      .innerJoin(orders, eq(feedback.order_id, orders.id))
      .where(
        and(
          eq(feedback.blueprint_id, params.blueprintId),
          eq(feedback.user_id, params.userId),
          eq(feedback.completion_status, "completed"),
          eq(feedback.validity, "valid"),
          eq(orders.task_type, "recovery"),
        ),
      );

    if ((recoveryCount ?? 0) === 0) {
      return {
        eligible: false,
        blockedReason: "Recovery must be attempted before a strategic review in Danger condition",
      };
    }
  }

  const [openReview] = await db
    .select({ id: pivotReviews.id })
    .from(pivotReviews)
    .where(and(eq(pivotReviews.blueprint_id, params.blueprintId), eq(pivotReviews.status, "open")))
    .limit(1);

  if (openReview) {
    return { eligible: false, blockedReason: "An open pivot review already exists" };
  }

  return { eligible: true };
}

export async function checkAutomaticPivotTrigger(params: {
  blueprintId: string;
  userId: string;
}): Promise<boolean> {
  const [mem] = await db
    .select()
    .from(stateMemory)
    .where(and(eq(stateMemory.blueprint_id, params.blueprintId), eq(stateMemory.is_current, true)))
    .limit(1);

  if (!mem) return false;

  const condition = mem.condition;
  const durationDays = mem.duration_days ?? 0;

  const triggerConditions = [
    condition === "danger" && durationDays >= 10,
    condition === "urgency" && durationDays >= 14,
  ];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const [{ cycleCount }] = await db
    .select({ cycleCount: sql<number>`count(*)::int` })
    .from(stateMemory)
    .where(and(eq(stateMemory.blueprint_id, params.blueprintId), gte(stateMemory.entered_at, thirtyDaysAgo)));

  const repeatedCycling = (cycleCount ?? 0) >= 6;

  return triggerConditions.some(Boolean) || repeatedCycling;
}

export async function generatePivotPathOptions(params: {
  blueprintId: string;
  userId: string;
  pivotReviewId: string;
}): Promise<void> {
  const [blueprint] = await db
    .select({ goal: blueprints.goal, state_version: blueprints.state_version })
    .from(blueprints)
    .where(eq(blueprints.id, params.blueprintId))
    .limit(1);

  const [signal] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, params.blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);

  const [conditionRow] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, params.blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const [stateMem] = await db
    .select()
    .from(stateMemory)
    .where(and(eq(stateMemory.blueprint_id, params.blueprintId), eq(stateMemory.is_current, true)))
    .limit(1);

  if (!blueprint || !signal || !conditionRow) {
    logger.warn({ blueprintId: params.blueprintId }, "[StrategyEngine] Missing signal/condition — skipping path generation");
    return;
  }

  let pathOptions: unknown[] = [];

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "StrategyEngine",
      triggerType: "ROOT_CAUSE_ASSIST",
      userId: params.userId,
      blueprintId: params.blueprintId,
      stateVersion: blueprint.state_version,
      idempotencyKey: `pivot_paths:${params.pivotReviewId}`,
      facts: {
        goal: blueprint.goal,
        condition: conditionRow.condition,
        durationDays: stateMem?.duration_days ?? 0,
        completionRate: signal.completion_rate,
        weightedScore: signal.weighted_score,
        trend: signal.trend,
        momentum: signal.momentum,
      },
    });

    if (result.ok && result.output?.outputType === "root_cause_candidates") {
      const data = result.output.data as { candidates?: unknown[] };
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        pathOptions = data.candidates;
      }
    }
  } catch {
    /* deterministic paths below */
  }

  if (pathOptions.length === 0) {
    pathOptions = buildDeterministicPaths(
      conditionRow.condition,
      stateMem?.duration_days ?? 0,
      signal.completion_rate,
    );
  }

  await db
    .update(pivotReviews)
    .set({ path_options_json: pathOptions })
    .where(eq(pivotReviews.id, params.pivotReviewId));
}

function buildDeterministicPaths(condition: string, durationDays: number, completionRate: number): Record<string, unknown>[] {
  const riskLevel = completionRate < 0.3 ? "high" : completionRate < 0.6 ? "medium" : "low";

  return [
    {
      type: "continue",
      title: "Continue with refined approach",
      rationale: `After ${durationDays} days in ${condition} condition, continuing with execution method adjustments may restore momentum.`,
      expectedImpact: "Refined task approach without changing direction.",
      riskLevel,
      preservedWork: "All current progress, phases, and targets preserved.",
      whatChanges: "Task generation approach and difficulty calibration adjusted.",
      estimatedReset: "Immediate — no reset period.",
    },
    {
      type: "adjust",
      title: "Same goal, new approach",
      rationale: `Persistent ${condition} suggests the current strategy needs rethinking while keeping the core goal intact.`,
      expectedImpact: "Restructured execution path with same end goal.",
      riskLevel: "medium",
      preservedWork: "Completed targets and phases preserved. Capability carries forward.",
      whatChanges: "Incomplete targets regenerated. Active tasks cleared. 3–7 day recovery period.",
      estimatedReset: "3–7 days of recovery tasks.",
    },
    {
      type: "pivot",
      title: "Change direction entirely",
      rationale: "The current direction has shown sustained failure signals. A new direction may achieve better results.",
      expectedImpact: "New blueprint structure from plan level down.",
      riskLevel: "high",
      preservedWork: "Capability and identity carry forward. Prior work archived.",
      whatChanges: "Blueprint structure archived. New direction generated.",
      estimatedReset: "7–14 days of restart tasks.",
    },
  ];
}

export class StrategyEngine {
  evaluatePivotEligibility(p: Parameters<typeof evaluatePivotEligibility>[0]) {
    return evaluatePivotEligibility(p);
  }
  checkAutomaticPivotTrigger(p: Parameters<typeof checkAutomaticPivotTrigger>[0]) {
    return checkAutomaticPivotTrigger(p);
  }
  generatePivotPathOptions(p: Parameters<typeof generatePivotPathOptions>[0]) {
    return generatePivotPathOptions(p);
  }
}
