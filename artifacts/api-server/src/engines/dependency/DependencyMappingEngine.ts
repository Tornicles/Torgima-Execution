import { db, orders, orderDependencies, phases } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export interface ExecutabilityResult {
  executable:         boolean;
  blockingDependencies: Array<{ dependencyType: string; reason: string; resolutionStrategy: string }>;
  recommendedNextAction: "PUBLISH_TASK" | "GENERATE_RESOLUTION_TASK" | "WAIT" | "SYSTEM_REPAIR";
  unlockValueScore:   number;
}

const DONE = ["completed", "skipped", "cancelled"] as const;

export async function checkExecutability(params: {
  blueprintId: string;
  userId:      string;
  orderId:     string;
}): Promise<ExecutabilityResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  if (!order) {
    return {
      executable: false,
      blockingDependencies: [
        {
          dependencyType:     "SYSTEM_STATE",
          reason:             "Order not found",
          resolutionStrategy: "system_repair",
        },
      ],
      recommendedNextAction: "SYSTEM_REPAIR",
      unlockValueScore:      0,
    };
  }

  const blockingDeps: ExecutabilityResult["blockingDependencies"] = [];

  const orderDeps = await db
    .select()
    .from(orderDependencies)
    .where(eq(orderDependencies.blocked_order_id, params.orderId));

  for (const dep of orderDeps) {
    const [blockingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, dep.blocking_order_id))
      .limit(1);
    if (
      blockingOrder &&
      !(DONE as readonly string[]).includes(blockingOrder.status)
    ) {
      blockingDeps.push({
        dependencyType:     "SEQUENCE",
        reason:             `Task "${blockingOrder.title}" must be completed first`,
        resolutionStrategy: "complete_prerequisite",
      });
    }
  }

  if (order.linked_phase_id) {
    const [phase] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, order.linked_phase_id))
      .limit(1);
    if (phase?.locked) {
      blockingDeps.push({
        dependencyType:     "SEQUENCE",
        reason:             `Phase ${phase.name} is locked — complete previous phase first`,
        resolutionStrategy: "complete_prerequisite",
      });
    }
  }

  const executable = blockingDeps.length === 0;
  const unlockValue = blockingDeps.length > 0 ? 8.0 : 0;

  logger.debug(
    { executable, blocking: blockingDeps.length, orderId: params.orderId },
    "[DependencyEngine] checkExecutability",
  );

  return {
    executable,
    blockingDependencies: blockingDeps,
    recommendedNextAction: executable ? "PUBLISH_TASK" : "GENERATE_RESOLUTION_TASK",
    unlockValueScore:      unlockValue,
  };
}

export async function createDependency(params: {
  blueprintId:      string;
  blockingOrderId:  string;
  blockedOrderId:   string;
}): Promise<void> {
  try {
    await db.insert(orderDependencies).values({
      blueprint_id:      params.blueprintId,
      blocking_order_id: params.blockingOrderId,
      blocked_order_id:  params.blockedOrderId,
    });
  } catch (err) {
    logger.debug({ err }, "[DependencyEngine] createDependency skipped (likely duplicate)");
  }
}
