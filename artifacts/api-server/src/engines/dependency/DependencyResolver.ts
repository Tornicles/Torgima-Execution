/**
 * DOC26 Task 4 — resolution task generation and engine routing.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { EventType } from "../../types/eventContracts.js";
import {
  resolutionTaskForDependencyType,
  type DependencyType,
} from "./dependencyResolution.js";
import type { ResolutionTaskSpec } from "../execution-loop/DependencyEngine.js";
import type { BlockingDependency, DependencyContext } from "./dependencyTypes.js";

export const RESOLUTION_TASK_TYPE_MAP: Record<DependencyType, string> = {
  SEQUENCE: "blocker_resolution",
  DECISION: "clarification",
  INFORMATION: "clarification",
  ASSET: "clarification",
  PERMISSION: "blocker_resolution",
  EXTERNAL_RESPONSE: "blocker_resolution",
  CAPABILITY: "academy",
  SYSTEM_STATE: "recovery",
  OUTCOME_PROOF: "review",
};

export function resolutionEventForDependency(type: DependencyType): string {
  if (type === "CAPABILITY") return "erector_capability_gap_detected";
  if (type === "SYSTEM_STATE") return "system_repair_requested";
  return "dependency_resolution_task_requested";
}

export function mapResolutionEventToContract(eventName: string): EventType {
  switch (eventName) {
    case "erector_capability_gap_detected":
      return EVENT_TYPES.ERECTOR_CAPABILITY_GAP_DETECTED;
    case "system_repair_requested":
      return EVENT_TYPES.SYSTEM_HEALTH_DEGRADED;
    case "dependency_resolution_task_requested":
      return EVENT_TYPES.DEPENDENCY_RESOLUTION_TASK_REQUESTED;
    default:
      return EVENT_TYPES.DEPENDENCY_RESOLUTION_REQUESTED;
  }
}

export function generateResolutionTaskSpec(
  dependency: BlockingDependency,
): ResolutionTaskSpec {
  return resolutionTaskForDependencyType(dependency.type, {
    title: dependency.description,
    instruction: dependency.description,
    blockerLabel: dependency.description,
  });
}

export async function generateResolutionTask(params: {
  dependency: BlockingDependency;
  context: DependencyContext;
}): Promise<{ eventName: string; eventType: EventType; resolutionTask: ResolutionTaskSpec }> {
  const eventName = resolutionEventForDependency(params.dependency.type);
  const eventType = mapResolutionEventToContract(eventName);
  const resolutionTask = generateResolutionTaskSpec(params.dependency);

  await writeEvent({
    eventType,
    entityType: "order",
    entityId: params.context.candidateTaskId,
    userId: params.context.userId,
    blueprintId: params.context.blueprintId,
    payload: {
      dependency_id: params.dependency.dependencyId,
      dependency_type: params.dependency.type,
      resolution_strategy: params.dependency.resolutionStrategy,
      blocked_task_id: params.context.candidateTaskId,
      resolution_task_type: RESOLUTION_TASK_TYPE_MAP[params.dependency.type],
      target_engine:
        params.dependency.type === "CAPABILITY"
          ? "AcademyEngine"
          : params.dependency.type === "SYSTEM_STATE"
            ? "StateIntegrityEngine"
            : "TaskGenerationEngine",
    },
    idempotencyKey: `dependency_resolution:${params.context.candidateTaskId}:${params.dependency.type}:${params.dependency.dependencyId ?? "none"}`,
  }).catch(() => null);

  return { eventName, eventType, resolutionTask };
}

/** Publish resolution order instead of blocked task (DOC26 law). */
export async function resolveBlockedExecution(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
  executability: {
    executable: boolean;
    blockingDependencies: BlockingDependency[];
    resolutionTask?: ResolutionTaskSpec;
  };
}): Promise<{ orderId: string; replaced: boolean; eventName?: string }> {
  if (params.executability.executable) {
    return { orderId: params.orderId, replaced: false };
  }

  const primary = params.executability.blockingDependencies.find((dep) => dep.blocking !== false)
    ?? params.executability.blockingDependencies[0];

  if (!primary) {
    return { orderId: params.orderId, replaced: false };
  }

  const routed = await generateResolutionTask({
    dependency: primary,
    context: {
      blueprintId: params.blueprintId,
      userId: params.userId,
      candidateTaskId: params.orderId,
      orderId: params.orderId,
    },
  });

  const { dependencyEngine } = await import("../execution-loop/DependencyEngine.js");
  const resolutionId = await dependencyEngine.insertResolutionOrder({
    blueprintId: params.blueprintId,
    userId: params.userId,
    blockedOrderId: params.orderId,
    resolutionTask: params.executability.resolutionTask ?? routed.resolutionTask,
  });

  return {
    orderId: resolutionId,
    replaced: true,
    eventName: routed.eventName,
  };
}
