/**
 * DOC26 — DependencyEngine facade for mapping, executability, and resolution.
 */

import { db, orderDependencies } from "@workspace/db";
import { logger } from "../../lib/logger.js";
import {
  checkExecutability,
  collectDependencyBlockedOrderIds,
  evaluateExecutabilityFromBlocks,
  type ExecutabilityResult,
} from "./ExecutabilityChecker.js";
import { resolveBlockedExecution } from "./DependencyResolver.js";
import type { DependencyType } from "./dependencyResolution.js";

export type { ExecutabilityResult } from "./ExecutabilityChecker.js";
export type { CandidateTask, BlockingDependency, DependencyContext } from "./dependencyTypes.js";
export {
  DEPENDENCY_TYPES,
  calculateUnlockValue,
  unlockValueForDependency,
  resolutionTaskForDependencyType,
  normalizeDependencyType,
  type DependencyType,
} from "./dependencyResolution.js";
export {
  checkExecutability,
  collectDependencyBlockedOrderIds,
  evaluateExecutabilityFromBlocks,
} from "./ExecutabilityChecker.js";
export {
  generateResolutionTask,
  resolveBlockedExecution,
  resolutionEventForDependency,
  RESOLUTION_TASK_TYPE_MAP,
} from "./DependencyResolver.js";

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
    logger.debug({ err }, "[DependencyEngine] createDependency skipped (likely duplicate)");
  }
}

export async function ensureResolvablePublication(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
}): Promise<{ orderId: string; replaced: boolean }> {
  const exec = await checkExecutability(params);
  const resolved = await resolveBlockedExecution({
    blueprintId: params.blueprintId,
    userId: params.userId,
    orderId: params.orderId,
    executability: exec,
  });
  return { orderId: resolved.orderId, replaced: resolved.replaced };
}
