import { db, blueprints, orders, executionSessions } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { generate } from "../task-generation/TaskGenerationEngine.js";
import { getBehavioralProfile } from "../../bhudhi/agents/ConditionAgent.js";
import { getBasicProfile } from "../../bhudhi/agents/BehavioralAgent.js";
import { getLatestBurnoutRecord, getBurnoutAdjustment } from "../burnout/BurnoutDetectionEngine.js";
import { assessMotivationState } from "../../bhudhi/agents/PsychologyAgent.js";
import { selectPackage, packageToInjection } from "../../bhudhi/agents/KnowledgeAgent.js";
import { logger } from "../../lib/logger.js";
import { BlueprintStatus, OrderStatus } from "@workspace/state-machine";

export interface GenerateNextTaskOptions {
  condition?: string;
  blueprintId?: string;
  reason: string;
  generationMode?: string;
}

export interface GenerateNextTaskResult {
  order: typeof orders.$inferSelect | null;
  blocked: boolean;
  blockReason?: string;
  knowledgeInjected: boolean;
  generationMs: number;
}

export async function generateNextTask(
  userId: string,
  options: GenerateNextTaskOptions,
): Promise<GenerateNextTaskResult> {
  const start = Date.now();

  const [bp] = options.blueprintId
    ? await db
        .select()
        .from(blueprints)
        .where(
          and(
            eq(blueprints.id, options.blueprintId),
            eq(blueprints.user_id, userId),
            eq(blueprints.active, true),
            eq(blueprints.status, BlueprintStatus.ACTIVE),
          ),
        )
        .limit(1)
    : await db
        .select()
        .from(blueprints)
        .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)))
        .limit(1);

  if (!bp) {
    return {
      order: null,
      blocked: true,
      blockReason: "NO_ACTIVE_BLUEPRINT",
      knowledgeInjected: false,
      generationMs: Date.now() - start,
    };
  }

  const profile = await getBehavioralProfile(userId, bp.id);
  const behavioral = await getBasicProfile(userId);
  const burnout = await getLatestBurnoutRecord(userId);
  const burnoutAdj = burnout ? getBurnoutAdjustment(burnout) : null;
  const motivation = await assessMotivationState(userId);
  const effectiveMode =
    motivation.requiresMeaningReconnect ? "meaning_reconnect"
    : options.generationMode ?? mapReasonToMode(options.reason);

  const [{ activeCount } = { activeCount: 0 }] = await db
    .select({ activeCount: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, bp.id),
        eq(orders.user_id, userId),
        inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE, OrderStatus.PRE_GENERATED]),
      ),
    );

  if ((activeCount ?? 0) >= profile.maxActiveTasks) {
    return {
      order: null,
      blocked: true,
      blockReason: "TASK_COUNT_CAP",
      knowledgeInjected: false,
      generationMs: Date.now() - start,
    };
  }

  const knowledgePackage = await selectPackage({
    domain: bp.current_domain ?? "delivery",
    actionType: bp.current_domain ?? "Create",
    userId,
  });

  const genResult = await generate({
    blueprintId: bp.id,
    userId,
    generationMode: effectiveMode,
    generationTrigger: options.reason,
  });

  if (genResult.orders_generated === 0 || !genResult.order_ids[0]) {
    return {
      order: null,
      blocked: false,
      knowledgeInjected: Boolean(knowledgePackage),
      generationMs: Date.now() - start,
    };
  }

  const orderId = genResult.order_ids[0]!;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (order && knowledgePackage) {
    const injection = packageToInjection(knowledgePackage);
    await db
      .update(orders)
      .set({
        command_context: {
          ...(order.command_context as Record<string, unknown>),
          knowledgeInjection: injection,
          taskLanguageTone: profile.taskTone,
          behavioralProfile: behavioral,
          burnoutAdjustment: burnoutAdj,
          meaningReconnect: motivation.requiresMeaningReconnect,
          knowledgeInjectionApplied: true,
        },
      })
      .where(eq(orders.id, orderId));
  } else if (order) {
    await db
      .update(orders)
      .set({
        command_context: {
          ...(order.command_context as Record<string, unknown>),
          taskLanguageTone: profile.taskTone,
          knowledgeInjectionApplied: false,
        },
      })
      .where(eq(orders.id, orderId));
  }

  await db
    .insert(executionSessions)
    .values({
      user_id: userId,
      blueprint_id: bp.id,
      session_type: "PRIMARY",
      tasks_generated: 1,
      session_health: "ACTIVE",
    })
    .catch(() => null);

  const [updated] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  logger.info(
    { userId, orderId, reason: options.reason, ms: Date.now() - start },
    "[generateNextTask] Complete",
  );

  return {
    order: updated ?? order ?? null,
    blocked: false,
    knowledgeInjected: Boolean(knowledgePackage),
    generationMs: Date.now() - start,
  };
}

function mapReasonToMode(reason: string): string {
  if (reason.includes("RECOVERY") || reason.includes("recovery")) return "recovery";
  if (reason.includes("DAILY") || reason.includes("PRE_GENERATED")) return "daily";
  if (reason.includes("FEEDBACK")) return "post_feedback";
  return "post_feedback";
}
