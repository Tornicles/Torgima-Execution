import { randomUUID } from "crypto";
import {
  db,
  blueprints,
  orders,
  pivotReviews,
  systemHealthLogs,
  deadLetterEvents,
  taskGenerationLog,
} from "@workspace/db";
import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { generate } from "../task-generation/TaskGenerationEngine.js";

export type GuaranteeState =
  | "SATISFIED"
  | "PUBLISH_PRIMARY"
  | "RECOVER_EMPTY"
  | "BLOCKED_BY_DEPENDENCY"
  | "BLOCKED_BY_CONDITION"
  | "SYSTEM_LOCKED"
  | "PIVOT_REVIEW"
  | "DEAD_LETTERED";

export async function guaranteeTask(params: {
  blueprintId: string;
  userId: string;
  generationMode?: string;
  generationTrigger?: string;
  enforcementPackageId?: string;
  causationEventId?: string;
}): Promise<{ state: GuaranteeState; orderId?: string }> {
  const { blueprintId, userId } = params;

  const [blueprint] = await db
    .select({
      id: blueprints.id,
      status: blueprints.status,
      active: blueprints.active,
      goal: blueprints.goal,
    })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);

  if (!blueprint || !blueprint.active) return { state: "SYSTEM_LOCKED" };
  if (blueprint.status === "complete") return { state: "SYSTEM_LOCKED" };
  if (blueprint.status === "paused") return { state: "SYSTEM_LOCKED" };

  const [openPivot] = await db
    .select({ id: pivotReviews.id })
    .from(pivotReviews)
    .where(and(eq(pivotReviews.blueprint_id, blueprintId), eq(pivotReviews.status, "open")))
    .limit(1);

  if (openPivot) {
    const existing = await findActionableOrder(blueprintId, userId);
    if (!existing) {
      const holdOrder = await createHoldTask(blueprintId, userId, blueprint.goal);
      return { state: "PIVOT_REVIEW", orderId: holdOrder ?? undefined };
    }
    return { state: "PIVOT_REVIEW", orderId: existing };
  }

  const existingOrder = await findActionableOrder(blueprintId, userId);
  if (existingOrder) {
    logger.info({ blueprintId, orderId: existingOrder }, "[Guarantee] SATISFIED — task already exists");
    return { state: "SATISFIED", orderId: existingOrder };
  }

  const [criticalHealth] = await db
    .select({ id: systemHealthLogs.id })
    .from(systemHealthLogs)
    .where(
      and(
        eq(systemHealthLogs.blueprint_id, blueprintId),
        eq(systemHealthLogs.status, "degraded"),
        inArray(systemHealthLogs.check_type, ["FATAL", "CRITICAL"]),
      ),
    )
    .limit(1);

  if (criticalHealth) return { state: "SYSTEM_LOCKED" };

  const mode = params.generationMode ?? "post_feedback";
  const trigger = params.generationTrigger ?? "guarantee_check";

  try {
    const result = await generate({
      blueprintId,
      userId,
      generationMode: mode,
      generationTrigger: trigger,
      enforcementPackageId: params.enforcementPackageId,
      causationEventId: params.causationEventId,
    });

    if (result.orders_generated > 0 && result.order_ids[0]) {
      logger.info(
        { blueprintId, orderId: result.order_ids[0] },
        "[Guarantee] PUBLISH_PRIMARY — task generated",
      );
      return { state: "PUBLISH_PRIMARY", orderId: result.order_ids[0] };
    }
  } catch (error) {
    logger.warn(
      {
        blueprintId,
        error: error instanceof Error ? error.message : String(error),
      },
      "[Guarantee] Primary generation failed — entering fallback",
    );
  }

  try {
    const recoveryResult = await generate({
      blueprintId,
      userId,
      generationMode: "recovery",
      generationTrigger: "guarantee_fallback",
      causationEventId: params.causationEventId,
    });

    if (recoveryResult.orders_generated > 0 && recoveryResult.order_ids[0]) {
      await logFallbackHealth(blueprintId);
      return { state: "RECOVER_EMPTY", orderId: recoveryResult.order_ids[0] };
    }
  } catch {
    /* continue */
  }

  const holdTaskId = await createHoldTask(blueprintId, userId, blueprint.goal);
  if (holdTaskId) {
    await logFallbackHealth(blueprintId);
    return { state: "RECOVER_EMPTY", orderId: holdTaskId };
  }

  await db
    .insert(deadLetterEvents)
    .values({
      original_event_id: params.causationEventId ?? randomUUID(),
      event_type: "task_guarantee_failure",
      blueprint_id: blueprintId,
      user_id: userId,
      payload: { reason: "All fallbacks failed" },
      failure_reason: "Guarantee engine exhausted all fallback options",
      retry_count: 0,
      last_error: "No task could be generated",
    })
    .catch(() => null);

  return { state: "DEAD_LETTERED" };
}

async function findActionableOrder(blueprintId: string, userId: string): Promise<string | null> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        inArray(orders.status, ["pending", "active"]),
      ),
    )
    .orderBy(desc(orders.priority))
    .limit(1);

  return order?.id ?? null;
}

async function createHoldTask(
  blueprintId: string,
  userId: string,
  goal: string,
): Promise<string | null> {
  try {
    const [order] = await db
      .insert(orders)
      .values({
        blueprint_id: blueprintId,
        user_id: userId,
        task_type: "recovery",
        title: "Return to Execution",
        instruction: `Your execution system is ready and waiting.\n\nYour goal: "${goal.slice(0, 200)}"\n\nChoose one small, concrete action you can complete today toward this goal. Write it down, execute it, then submit feedback.`,
        expected_output: "One completed action with feedback submitted.",
        definition_of_done:
          "You completed one action and submitted feedback describing what you did.",
        why_it_matters:
          "Returning to execution is the most important step. One task restarts momentum.",
        time_estimate_minutes: 20,
        proof_required: false,
        difficulty: "very_easy",
        priority: 3,
        status: "pending",
        generation_reason: "guarantee_hold_task",
        domain: "delivery",
      })
      .returning({ id: orders.id });

    return order?.id ?? null;
  } catch {
    return null;
  }
}

async function logFallbackHealth(blueprintId: string): Promise<void> {
  const [{ c } = { c: 0 }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(taskGenerationLog)
    .where(
      and(
        eq(taskGenerationLog.blueprint_id, blueprintId),
        eq(taskGenerationLog.used_fallback, true),
        gte(taskGenerationLog.created_at, new Date(Date.now() - 24 * 3600000)),
      ),
    );

  const recentFallbacks = c ?? 0;

  if (recentFallbacks >= 3) {
    await db
      .insert(systemHealthLogs)
      .values({
        blueprint_id: blueprintId,
        check_type: "TASK_GUARANTEE_REPEATED_FALLBACK",
        status: "degraded",
        details_json: { fallback_count: recentFallbacks },
        issues_detected: ["Repeated task guarantee fallbacks"],
      })
      .catch(() => null);
  }
}
