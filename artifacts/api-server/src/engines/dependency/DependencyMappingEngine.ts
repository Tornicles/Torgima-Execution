import {
  db,
  orders,
  orderDependencies,
  phases,
  capabilityProfiles,
  outcomeValidations,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import {
  type DependencyType,
  unlockValueForDependency,
  resolutionTaskForDependencyType,
} from "./dependencyResolution.js";

export interface ExecutabilityResult {
  executable: boolean;
  blockingDependencies: Array<{
    dependencyType: DependencyType | string;
    reason: string;
    resolutionStrategy: string;
  }>;
  recommendedNextAction: "PUBLISH_TASK" | "GENERATE_RESOLUTION_TASK" | "WAIT" | "SYSTEM_REPAIR";
  unlockValueScore: number;
  resolutionTask?: ReturnType<typeof resolutionTaskForDependencyType>;
}

const DONE = ["completed", "skipped", "cancelled"] as const;

const CAPABILITY_ORDER = ["beginner", "developing", "competent", "advanced", "expert"] as const;

function capabilityMeets(required: string | null | undefined, actual: string | null | undefined): boolean {
  if (!required) return true;
  const r = CAPABILITY_ORDER.indexOf((required ?? "beginner") as (typeof CAPABILITY_ORDER)[number]);
  const a = CAPABILITY_ORDER.indexOf((actual ?? "beginner") as (typeof CAPABILITY_ORDER)[number]);
  if (r < 0 || a < 0) return true;
  return a >= r;
}

export async function checkExecutability(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
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
          dependencyType: "SYSTEM_STATE",
          reason: "Order not found",
          resolutionStrategy: "system_repair",
        },
      ],
      recommendedNextAction: "SYSTEM_REPAIR",
      unlockValueScore: 0,
      resolutionTask: resolutionTaskForDependencyType("SYSTEM_STATE", {}),
    };
  }

  const blockingDeps: ExecutabilityResult["blockingDependencies"] = [];
  let unlockValue = 0;
  let primaryDepType: DependencyType = "SEQUENCE";
  let blocksMultiple = false;

  const orderDeps = await db
    .select()
    .from(orderDependencies)
    .where(eq(orderDependencies.blocked_order_id, params.orderId));

  if (orderDeps.length > 1) blocksMultiple = true;

  for (const dep of orderDeps) {
    const depType = (dep.dependency_type?.toUpperCase() ?? "SEQUENCE") as DependencyType;
    const [blockingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, dep.blocking_order_id))
      .limit(1);
    if (
      blockingOrder &&
      !(DONE as readonly string[]).includes(blockingOrder.status)
    ) {
      primaryDepType =
        dep.dependency_type?.toUpperCase() === "SEQUENTIAL" || depType === "SEQUENCE"
          ? "SEQUENCE"
          : depType;
      blockingDeps.push({
        dependencyType: primaryDepType,
        reason: `Task "${blockingOrder.title}" must be completed first`,
        resolutionStrategy: "complete_prerequisite",
      });
      unlockValue = Math.max(
        unlockValue,
        unlockValueForDependency(primaryDepType, blocksMultiple, true),
      );
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
        dependencyType: "SEQUENCE",
        reason: `Phase ${phase.name} is locked — complete previous phase first`,
        resolutionStrategy: "complete_prerequisite",
      });
      unlockValue = Math.max(unlockValue, unlockValueForDependency("SEQUENCE", false, true));
      primaryDepType = "SEQUENCE";
    }
  }

  const meta = (order.trace_metadata ?? {}) as Record<string, unknown>;
  const requiredCapability =
    typeof meta.required_capability_level === "string"
      ? meta.required_capability_level
      : typeof meta.required_capability === "string"
        ? meta.required_capability
        : null;

  if (requiredCapability) {
    const [cap] = await db
      .select({ level: capabilityProfiles.level })
      .from(capabilityProfiles)
      .where(eq(capabilityProfiles.user_id, params.userId))
      .limit(1);

    if (!capabilityMeets(requiredCapability, cap?.level ?? "beginner")) {
      blockingDeps.push({
        dependencyType: "CAPABILITY",
        reason: `Capability level ${requiredCapability} required`,
        resolutionStrategy: "academy_task",
      });
      primaryDepType = "CAPABILITY";
      unlockValue = Math.max(
        unlockValue,
        unlockValueForDependency("CAPABILITY", false, true),
      );
    }
  }

  const requiredOutcomeId =
    typeof meta.required_outcome_validation_id === "string"
      ? meta.required_outcome_validation_id
      : null;

  if (requiredOutcomeId) {
    const [ov] = await db
      .select({ validation_result: outcomeValidations.validation_result })
      .from(outcomeValidations)
      .where(eq(outcomeValidations.id, requiredOutcomeId))
      .limit(1);

    if (!ov || ov.validation_result !== "validated") {
      blockingDeps.push({
        dependencyType: "OUTCOME_PROOF",
        reason: "Required outcome is not yet validated",
        resolutionStrategy: "outcome_evidence",
      });
      primaryDepType = "OUTCOME_PROOF";
      unlockValue = Math.max(
        unlockValue,
        unlockValueForDependency("OUTCOME_PROOF", false, true),
      );
    }
  }

  if (typeof meta.external_dependency_pending === "boolean" && meta.external_dependency_pending) {
    blockingDeps.push({
      dependencyType: "EXTERNAL_RESPONSE",
      reason: "Waiting on external response or approval",
      resolutionStrategy: "external_follow_up",
    });
    primaryDepType = "EXTERNAL_RESPONSE";
    unlockValue = Math.max(
      unlockValue,
      unlockValueForDependency("EXTERNAL_RESPONSE", false, false),
    );
  }

  const executable = blockingDeps.length === 0;

  const resolutionTask = executable
    ? undefined
    : resolutionTaskForDependencyType(primaryDepType, {
        title: blockingDeps[0]?.reason,
        blockerLabel: blockingDeps[0]?.reason,
      });

  logger.debug(
    { executable, blocking: blockingDeps.length, orderId: params.orderId, unlockValue },
    "[DependencyMappingEngine] checkExecutability",
  );

  return {
    executable,
    blockingDependencies: blockingDeps,
    recommendedNextAction: executable ? "PUBLISH_TASK" : "GENERATE_RESOLUTION_TASK",
    unlockValueScore: unlockValue,
    resolutionTask,
  };
}

/** Orders that fail executability — excluded from priority ranking (score 0). */
export async function collectDependencyBlockedOrderIds(params: {
  blueprintId: string;
  userId: string;
  orderIds: string[];
}): Promise<Set<string>> {
  const blocked = new Set<string>();
  for (const orderId of params.orderIds) {
    const result = await checkExecutability({
      blueprintId: params.blueprintId,
      userId: params.userId,
      orderId,
    });
    if (!result.executable) blocked.add(orderId);
  }
  return blocked;
}

export async function createDependency(params: {
  blueprintId: string;
  blockingOrderId: string;
  blockedOrderId: string;
  dependencyType?: DependencyType;
}): Promise<void> {
  try {
    await db.insert(orderDependencies).values({
      blueprint_id: params.blueprintId,
      blocking_order_id: params.blockingOrderId,
      blocked_order_id: params.blockedOrderId,
      dependency_type: params.dependencyType ?? "SEQUENCE",
      status: "pending",
    });
  } catch (err) {
    logger.debug({ err }, "[DependencyMappingEngine] createDependency skipped (likely duplicate)");
  }
}

/** Publish resolution order when mapping engine finds a block (DOC 26 law). */
export async function ensureResolvablePublication(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
}): Promise<{ orderId: string; replaced: boolean }> {
  const check = await checkExecutability(params);
  if (check.executable || !check.resolutionTask) {
    return { orderId: params.orderId, replaced: false };
  }

  const { dependencyEngine } = await import("../execution-loop/DependencyEngine.js");
  const resolutionId = await dependencyEngine.insertResolutionOrder({
    blueprintId: params.blueprintId,
    userId: params.userId,
    blockedOrderId: params.orderId,
    resolutionTask: check.resolutionTask,
  });

  return { orderId: resolutionId, replaced: true };
}
