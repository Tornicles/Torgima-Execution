import { writeEvent } from "../../services/EventService.js";
import { EventTypes } from "../../types/eventContracts.js";
import type { ArchetypeResolutionOutput } from "../../types/erector.js";

export async function emitArchetypeResolved(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  archetypeResolution: ArchetypeResolutionOutput;
}): Promise<void> {
  await writeEvent({
    eventType: EventTypes.ARCHETYPE_RESOLVED,
    entityType: "validation",
    entityId: params.validationId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      validation_id: params.validationId,
      archetype_resolution: params.archetypeResolution,
    },
    idempotencyKey: `archetype_resolved:${params.validationId}`,
  }).catch(() => null);
}

export async function emitErectorEngineCompleted(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  engineName: string;
  success?: boolean;
  fallbackUsed?: boolean;
}): Promise<void> {
  await writeEvent({
    eventType: EventTypes.ERECTOR_ENGINE_COMPLETED,
    entityType: "validation",
    entityId: params.validationId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      validation_id: params.validationId,
      engine_name: params.engineName,
      success: params.success ?? true,
      fallback_used: params.fallbackUsed ?? false,
    },
    idempotencyKey: `erector_engine:${params.validationId}:${params.engineName}`,
  }).catch(() => null);
}

export async function emitErectorFirstWeekGenerated(params: {
  validationId: string;
  blueprintId: string;
  userId: string;
  taskCount: number;
  smokeTestCount?: number;
}): Promise<void> {
  await writeEvent({
    eventType: EventTypes.ERECTOR_FIRST_WEEK_GENERATED,
    entityType: "validation",
    entityId: params.validationId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      validation_id: params.validationId,
      task_count: params.taskCount,
      smoke_test_count: params.smokeTestCount ?? params.taskCount,
    },
    idempotencyKey: `erector_first_week:${params.validationId}`,
  }).catch(() => null);
}
