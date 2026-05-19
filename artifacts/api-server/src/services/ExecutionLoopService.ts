import { and, desc, eq } from "drizzle-orm";
import {
  blueprints,
  conditions,
  db,
  enforcementPackages,
  orders,
} from "@workspace/db";
import { runDailyLoop, type DailyLoopResult } from "../engines/execution-loop/runDailyLoopUser.js";
import { generateNextTask, type GenerateNextTaskResult } from "../engines/execution-loop/generateNextTask.js";
import { ensureActiveOrder } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { BlueprintStatus } from "@workspace/state-machine";

export interface ActiveOrderResult extends DailyLoopResult {
  order: typeof orders.$inferSelect | null;
  knowledgeInjection: unknown;
  currentCondition: string | null;
  enforcementPackageId: string | null;
}

export interface GenerateNextTaskInput {
  blueprintId: string;
  userId: string;
}

async function getActiveBlueprint(userId: string, blueprintId?: string) {
  const predicates = [
    eq(blueprints.user_id, userId),
    eq(blueprints.active, true),
    eq(blueprints.status, BlueprintStatus.ACTIVE),
  ];

  if (blueprintId) {
    predicates.push(eq(blueprints.id, blueprintId));
  }

  const [blueprint] = await db
    .select()
    .from(blueprints)
    .where(and(...predicates))
    .limit(1);

  return blueprint ?? null;
}

async function getCurrentExecutionContext(blueprintId: string) {
  const [condition] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .orderBy(desc(conditions.entered_at))
    .limit(1);

  const [enforcement] = await db
    .select()
    .from(enforcementPackages)
    .where(and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)))
    .orderBy(desc(enforcementPackages.created_at))
    .limit(1);

  return { condition: condition ?? null, enforcement: enforcement ?? null };
}

function extractKnowledgeInjection(order: typeof orders.$inferSelect | null): unknown {
  if (
    order?.command_context &&
    typeof order.command_context === "object" &&
    "knowledgeInjection" in (order.command_context as object)
  ) {
    return (order.command_context as { knowledgeInjection?: unknown }).knowledgeInjection ?? null;
  }

  return null;
}

async function getOrderById(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return order ?? null;
}

export const ExecutionLoopService = {
  async getActiveOrder(userId: string): Promise<ActiveOrderResult | null> {
    const blueprint = await getActiveBlueprint(userId);
    if (!blueprint) return null;

    const context = await getCurrentExecutionContext(blueprint.id);
    const ensured = await ensureActiveOrder(userId);
    const daily = await runDailyLoop(userId);
    const order = daily.activeOrder ?? (ensured.orderId ? await getOrderById(ensured.orderId) : null);

    return {
      ...daily,
      order,
      activeOrder: order,
      knowledgeInjection: extractKnowledgeInjection(order),
      currentCondition: context.condition?.condition ?? null,
      enforcementPackageId: context.enforcement?.id ?? null,
    };
  },

  async generateNextTask(input: GenerateNextTaskInput): Promise<GenerateNextTaskResult> {
    const blueprint = await getActiveBlueprint(input.userId, input.blueprintId);
    if (!blueprint) {
      return {
        order: null,
        blocked: true,
        blockReason: "NO_ACTIVE_BLUEPRINT",
        knowledgeInjected: false,
        generationMs: 0,
      };
    }

    const context = await getCurrentExecutionContext(blueprint.id);
    return generateNextTask(input.userId, {
      blueprintId: blueprint.id,
      condition: context.condition?.condition ?? undefined,
      reason: "MANUAL_REQUEST",
      generationMode: "post_feedback",
    });
  },
};
