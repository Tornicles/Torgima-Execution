/**
 * DOC26 Task 2 — executability checks before task publication.
 */

import {
  db,
  orders,
  orderDependencies,
  phases,
  capabilityProfiles,
  outcomeValidations,
  capabilityGapLogs,
  systemHealthLogs,
  projectDependencies,
  projects,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { ProjectStatus } from "@workspace/state-machine";
import {
  calculateUnlockValue,
  normalizeDependencyType,
  resolutionTaskForDependencyType,
  type DependencyType,
} from "./dependencyResolution.js";
import {
  normalizeBlockingDependency,
  type BlockingDependency,
  type CandidateTask,
  type ExecutabilityResult,
} from "./dependencyTypes.js";

export type { BlockingDependency, CandidateTask, ExecutabilityResult };

const DONE = ["completed", "skipped", "cancelled"] as const;

const CAPABILITY_ORDER = ["beginner", "developing", "competent", "advanced", "expert"] as const;

function capabilityMeets(required: string | null | undefined, actual: string | null | undefined): boolean {
  if (!required) return true;
  const r = CAPABILITY_ORDER.indexOf((required ?? "beginner") as (typeof CAPABILITY_ORDER)[number]);
  const a = CAPABILITY_ORDER.indexOf((actual ?? "beginner") as (typeof CAPABILITY_ORDER)[number]);
  if (r < 0 || a < 0) return true;
  return a >= r;
}

function pushBlock(
  list: BlockingDependency[],
  block: BlockingDependency,
): void {
  list.push(normalizeBlockingDependency(block));
}

/** CHECK 1 — sequence / prerequisite chain. */
async function checkSequenceDependencies(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
  order: typeof orders.$inferSelect;
}): Promise<BlockingDependency[]> {
  const blocks: BlockingDependency[] = [];

  const orderDeps = await db
    .select()
    .from(orderDependencies)
    .where(
      and(
        eq(orderDependencies.blocked_order_id, params.orderId),
        eq(orderDependencies.status, "pending"),
      ),
    );

  for (const dep of orderDeps) {
    const [blockingOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, dep.blocking_order_id))
      .limit(1);
    if (blockingOrder && !(DONE as readonly string[]).includes(blockingOrder.status)) {
      pushBlock(blocks, {
        type: "SEQUENCE",
        dependencyId: dep.id,
        description: `Action requires ${blockingOrder.title ?? dep.blocking_order_id} to be complete first`,
        resolutionStrategy: "complete_prerequisite_task",
      });
    }
  }

  if (params.order.linked_project_id) {
    const projDeps = await db
      .select()
      .from(projectDependencies)
      .where(
        and(
          eq(projectDependencies.blocked_project_id, params.order.linked_project_id),
          eq(projectDependencies.status, "PENDING"),
        ),
      );

    for (const dep of projDeps) {
      const [blockingProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, dep.blocking_project_id))
        .limit(1);
      if (blockingProject && blockingProject.status !== ProjectStatus.COMPLETE) {
        pushBlock(blocks, {
          type: "SEQUENCE",
          dependencyId: dep.id,
          description: `Project ${blockingProject.name ?? dep.blocking_project_id} must complete first`,
          resolutionStrategy: "complete_prerequisite_task",
        });
      }
    }
  }

  if (params.order.linked_phase_id) {
    const [phase] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, params.order.linked_phase_id))
      .limit(1);
    if (phase?.locked) {
      pushBlock(blocks, {
        type: "SEQUENCE",
        dependencyId: phase.id,
        description: `Phase ${phase.name} is locked — complete previous phase first`,
        resolutionStrategy: "complete_prerequisite_task",
      });
    }
  }

  return blocks;
}

/** CHECK 2 — capability gaps that block execution. */
async function checkCapabilityDependencies(params: {
  blueprintId: string;
  userId: string;
  order: typeof orders.$inferSelect;
}): Promise<BlockingDependency[]> {
  const blocks: BlockingDependency[] = [];
  const meta = (params.order.trace_metadata ?? {}) as Record<string, unknown>;
  const requiredCapability =
    typeof meta.required_capability_level === "string"
      ? meta.required_capability_level
      : typeof meta.required_capability === "string"
        ? meta.required_capability
        : null;

  const [capProfile] = await db
    .select({ level: capabilityProfiles.level })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  if (requiredCapability && !capabilityMeets(requiredCapability, capProfile?.level ?? "beginner")) {
    pushBlock(blocks, {
      type: "CAPABILITY",
      description: `Requires ${requiredCapability} which is not yet proven`,
      resolutionStrategy: "academy_task",
    });
  }

  const [openGap] = await db
    .select()
    .from(capabilityGapLogs)
    .where(
      and(
        eq(capabilityGapLogs.user_id, params.userId),
        eq(capabilityGapLogs.resolved, false),
      ),
    )
    .limit(1);

  if (openGap) {
    const metadata = (openGap.metadata_json ?? {}) as Record<string, unknown>;
    const blocksExecution =
      metadata.blocks_execution === true ||
      openGap.severity === "HIGH" ||
      openGap.gap_type === params.order.task_type;
    if (blocksExecution) {
      pushBlock(blocks, {
        type: "CAPABILITY",
        dependencyId: openGap.id,
        description: `Requires ${openGap.gap_type} capability which is not yet proven`,
        resolutionStrategy: "academy_task",
      });
    }
  }

  return blocks;
}

/** CHECK 3 — active system health lock. */
async function checkSystemStateDependencies(params: {
  blueprintId: string;
}): Promise<BlockingDependency[]> {
  const [healthLock] = await db
    .select()
    .from(systemHealthLogs)
    .where(
      and(
        eq(systemHealthLogs.blueprint_id, params.blueprintId),
        eq(systemHealthLogs.status, "OPEN"),
      ),
    )
    .limit(1);

  if (!healthLock) return [];

  return [
    normalizeBlockingDependency({
      type: "SYSTEM_STATE",
      dependencyId: healthLock.id,
      description: "System state requires repair before task can be published safely",
      resolutionStrategy: "system_repair",
    }),
  ];
}

/** CHECK 4 — typed order-level metadata dependencies. */
async function checkOrderLevelDependencies(params: {
  order: typeof orders.$inferSelect;
}): Promise<BlockingDependency[]> {
  const blocks: BlockingDependency[] = [];
  const meta = (params.order.trace_metadata ?? {}) as Record<string, unknown>;

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
      pushBlock(blocks, {
        type: "OUTCOME_PROOF",
        dependencyId: requiredOutcomeId,
        description: "Required outcome evidence is not yet validated",
        resolutionStrategy: "outcome_evidence",
      });
    }
  }

  if (typeof meta.external_dependency_pending === "boolean" && meta.external_dependency_pending) {
    pushBlock(blocks, {
      type: "EXTERNAL_RESPONSE",
      description: "Waiting on external response or approval",
      resolutionStrategy: "external_follow_up",
      blocking: false,
    });
  }

  const typedOrderDeps = await db
    .select()
    .from(orderDependencies)
    .where(eq(orderDependencies.blocked_order_id, params.order.id));

  for (const dep of typedOrderDeps) {
    const depType = normalizeDependencyType(dep.dependency_type);
    if (depType === "SEQUENCE") continue;
    if (dep.status !== "pending") continue;

    pushBlock(blocks, {
      type: depType,
      dependencyId: dep.id,
      description: dep.dependency_type ?? depType,
      resolutionStrategy: strategyForDependencyType(depType),
    });
  }

  const blockerType = typeof meta.blocker_type === "string" ? meta.blocker_type.toUpperCase() : null;
  if (blockerType === "DECISION") {
    pushBlock(blocks, {
      type: "DECISION",
      description: "A decision must be made before proceeding",
      resolutionStrategy: "decision_clarification_task",
    });
  } else if (blockerType === "INFORMATION") {
    pushBlock(blocks, {
      type: "INFORMATION",
      description: "Required information is missing",
      resolutionStrategy: "information_collection_task",
    });
  } else if (blockerType === "ASSET") {
    pushBlock(blocks, {
      type: "ASSET",
      description: "Required asset is missing",
      resolutionStrategy: "asset_collection_task",
    });
  } else if (blockerType === "PERMISSION") {
    pushBlock(blocks, {
      type: "PERMISSION",
      description: "Authorization to proceed is missing",
      resolutionStrategy: "permission_repair",
    });
  }

  return blocks;
}

function strategyForDependencyType(type: DependencyType): string {
  switch (type) {
    case "DECISION":
      return "decision_clarification_task";
    case "INFORMATION":
      return "information_collection_task";
    case "ASSET":
      return "asset_collection_task";
    case "PERMISSION":
      return "permission_repair";
    case "EXTERNAL_RESPONSE":
      return "external_follow_up";
    case "CAPABILITY":
      return "academy_task";
    case "SYSTEM_STATE":
      return "system_repair";
    case "OUTCOME_PROOF":
      return "outcome_evidence";
    default:
      return "complete_prerequisite_task";
  }
}

function hasPhaseGate(order: typeof orders.$inferSelect): boolean {
  const meta = (order.trace_metadata ?? {}) as Record<string, unknown>;
  return meta.phase_gate === true || meta.milestone === true;
}

function buildExecutabilityResult(
  blockingDependencies: BlockingDependency[],
  order: typeof orders.$inferSelect | null,
): ExecutabilityResult {
  const hardBlocks = blockingDependencies.filter((dep) => dep.blocking !== false);
  const executable = hardBlocks.length === 0;
  const primaryType = hardBlocks[0]?.type ?? blockingDependencies[0]?.type ?? "SEQUENCE";
  const unlock_value = calculateUnlockValue(hardBlocks.length > 0 ? hardBlocks : blockingDependencies, {
    blockedTaskCount: hardBlocks.length || blockingDependencies.length,
    hasPhaseGate: order ? hasPhaseGate(order) : false,
  });

  const resolutionTask = executable
    ? undefined
    : resolutionTaskForDependencyType(primaryType, {
        title: hardBlocks[0]?.description ?? blockingDependencies[0]?.description,
        blockerLabel: hardBlocks[0]?.description ?? blockingDependencies[0]?.description,
      });

  const recommendedNextAction = executable
    ? "PUBLISH_TASK"
    : primaryType === "SYSTEM_STATE"
      ? "SYSTEM_REPAIR"
      : primaryType === "EXTERNAL_RESPONSE"
        ? "WAIT"
        : "GENERATE_RESOLUTION_TASK";

  return {
    executable,
    blockingDependencies,
    unlock_value,
    unlockValueScore: unlock_value,
    recommendedNextAction,
    resolutionTask,
  };
}

export function evaluateExecutabilityFromBlocks(
  blockingDependencies: BlockingDependency[],
  order?: typeof orders.$inferSelect | null,
): ExecutabilityResult {
  return buildExecutabilityResult(
    blockingDependencies.map(normalizeBlockingDependency),
    order ?? null,
  );
}

export async function checkExecutability(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
  candidateTask?: CandidateTask;
}): Promise<ExecutabilityResult> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);

  if (!order) {
    return buildExecutabilityResult(
      [
        normalizeBlockingDependency({
          type: "SYSTEM_STATE",
          description: "Order not found",
          resolutionStrategy: "system_repair",
        }),
      ],
      null,
    );
  }

  const [sequenceBlocks, capabilityBlocks, systemBlocks, orderBlocks] = await Promise.all([
    checkSequenceDependencies({
      blueprintId: params.blueprintId,
      userId: params.userId,
      orderId: params.orderId,
      order,
    }),
    checkCapabilityDependencies({
      blueprintId: params.blueprintId,
      userId: params.userId,
      order,
    }),
    checkSystemStateDependencies({ blueprintId: params.blueprintId }),
    checkOrderLevelDependencies({ order }),
  ]);

  const blockingDependencies = [
    ...sequenceBlocks,
    ...capabilityBlocks,
    ...systemBlocks,
    ...orderBlocks,
  ];

  const result = buildExecutabilityResult(blockingDependencies, order);

  logger.debug(
    {
      executable: result.executable,
      blocking: result.blockingDependencies.length,
      orderId: params.orderId,
      unlock_value: result.unlock_value,
    },
    "[ExecutabilityChecker] checkExecutability",
  );

  return result;
}

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
