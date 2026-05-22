/**
 * Prompt 8 — Erector event workers (validation pipeline audit + side effects).
 */
import { db, blueprints, orders, validations } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob, type WorkerJobData, type WorkerResult } from "./BaseWorkerHandler.js";
import { logValidationStage } from "../engines/validation/ValidationEventLogService.js";
import { EventTypes } from "../types/eventContracts.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";
import {
  BlueprintStatus,
  ErectorValidationStage,
  ValidationStatus,
} from "@workspace/state-machine";
import type { ArchetypeResolutionOutput } from "../types/erector.js";

function validationIdFrom(data: WorkerJobData): string | null {
  const p = data.payload;
  return (
    (p.validation_id as string | undefined) ??
    (p.validationId as string | undefined) ??
    (data.entityType === "validation" ? data.entityId : undefined) ??
    null
  );
}

async function handleErectorValidationStarted(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  if (!validationId || !data.blueprintId || !data.userId) {
    return { success: false, retryable: false, reason: "Missing validation context" };
  }

  await db
    .update(validations)
    .set({
      validation_stage: ValidationStatus.RUNNING,
      erector_validation_stage: ErectorValidationStage.RUNNING,
      status: ValidationStatus.RUNNING,
    })
    .where(eq(validations.id, validationId));

  await logValidationStage({
    validationId,
    blueprintId: data.blueprintId,
    userId: data.userId,
    stage: "ERECTOR_STARTED",
    status: "RUNNING",
    message: "Erector validation run started",
    payload: { event_id: data.eventId },
  });

  logger.info({ validationId, blueprintId: data.blueprintId }, "[Erector] validation started");
  return { success: true };
}

async function handleArchetypeResolved(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  if (!validationId || !data.blueprintId || !data.userId) {
    return { success: false, retryable: false, reason: "Missing validation context" };
  }

  const resolution = data.payload.archetype_resolution as ArchetypeResolutionOutput | undefined;
  if (resolution) {
    await db
      .update(validations)
      .set({
        archetype_resolution: resolution,
        validation_stage: "archetype_resolved",
      })
      .where(eq(validations.id, validationId));
  }

  const archetypeName = resolution?.primaryArchetype?.name ?? "Unknown archetype";
  await logValidationStage({
    validationId,
    blueprintId: data.blueprintId,
    userId: data.userId,
    stage: "ARCHETYPE_RESOLVED",
    status: "COMPLETED",
    message: `Archetype resolved: ${archetypeName}`,
    payload: {
      archetype_name: archetypeName,
      execution_mult: resolution?.primaryArchetype?.executionIntensityMultiplier,
      timeframe_mult: resolution?.primaryArchetype?.timeframePressureMultiplier,
    },
  });

  logger.info({ validationId, archetypeName }, "[Erector] archetype resolved");
  return { success: true };
}

async function handleErectorEngineCompleted(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  const engineName = String(data.payload.engine_name ?? data.payload.engineName ?? "unknown");
  const success = data.payload.success !== false;
  const fallbackUsed = Boolean(data.payload.fallback_used ?? data.payload.fallbackUsed);

  if (validationId && data.blueprintId && data.userId) {
    await logValidationStage({
      validationId,
      blueprintId: data.blueprintId,
      userId: data.userId,
      stage: `ENGINE_${engineName.toUpperCase()}`,
      status: success ? "COMPLETED" : "FAILED",
      message: `${engineName} ${success ? "complete" : "failed"}${fallbackUsed ? " (fallback)" : ""}`,
      payload: { engine_name: engineName, success, fallback_used: fallbackUsed },
    });

    const [row] = await db
      .select({ intelligence_payload: validations.intelligence_payload })
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);

    const intel = (row?.intelligence_payload ?? {}) as Record<string, unknown>;
    const erectorMeta = (intel.erectorMeta ?? {}) as Record<string, unknown>;
    const enginesCompleted = Number(erectorMeta.enginesCompleted ?? 0) + 1;

    await db
      .update(validations)
      .set({
        intelligence_payload: {
          ...intel,
          erectorMeta: { ...erectorMeta, enginesCompleted },
        },
      })
      .where(eq(validations.id, validationId));
  }

  logger.info({ validationId, engineName, success, fallbackUsed }, "[Erector] engine completed");
  return { success: true };
}

async function handleErectorValidationCompleted(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  if (!validationId || !data.blueprintId || !data.userId) {
    return { success: false, retryable: false, reason: "Missing validation context" };
  }

  await db
    .update(validations)
    .set({
      validation_stage: ValidationStatus.COMPLETE,
      erector_validation_stage: ErectorValidationStage.COMPLETE,
      status: ValidationStatus.COMPLETE,
    })
    .where(eq(validations.id, validationId));

  await db
    .update(blueprints)
    .set({ status: BlueprintStatus.PATH_SELECTION })
    .where(and(eq(blueprints.id, data.blueprintId), eq(blueprints.user_id, data.userId)));

  await logValidationStage({
    validationId,
    blueprintId: data.blueprintId,
    userId: data.userId,
    stage: "COMPLETE",
    status: "COMPLETED",
    message: "Erector validation complete — select your path",
    payload: {
      reality_score: data.payload.realityScore ?? data.payload.reality_score,
      verdict: data.payload.verdict,
    },
  });

  await writeEvent({
    eventType: EVENT_TYPES.NOTIFICATION_SEND_REQUESTED,
    entityType: "validation",
    entityId: validationId,
    userId: data.userId,
    blueprintId: data.blueprintId,
    payload: {
      channel: "in_app",
      template: "erector_validation_complete",
      validation_id: validationId,
    },
    idempotencyKey: `erector_validation_notify:${validationId}`,
  }).catch(() => null);

  logger.info({ validationId, blueprintId: data.blueprintId }, "[Erector] validation completed");
  return { success: true };
}

async function handleErectorPathSelected(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  const selectedPath = String(data.payload.selectedPath ?? data.payload.selected_path ?? "");
  if (!validationId) {
    return { success: false, retryable: false, reason: "Missing validation id" };
  }

  const recommendedLevel = data.payload.recommended_blueprint_level as string | undefined;
  const pathValue =
    selectedPath === "current" || selectedPath === "adjusted" || selectedPath === "alternative"
      ? selectedPath
      : undefined;
  await db
    .update(validations)
    .set({
      ...(pathValue ? { selected_path_type: pathValue, selected_path: pathValue } : {}),
      ...(recommendedLevel ? { recommended_blueprint_level: recommendedLevel } : {}),
    })
    .where(eq(validations.id, validationId));

  if (data.blueprintId && data.userId) {
    await logValidationStage({
      validationId,
      blueprintId: data.blueprintId,
      userId: data.userId,
      stage: "PATH_SELECTED",
      status: "COMPLETED",
      message: `Path selected: ${selectedPath}`,
      payload: { selected_path: selectedPath },
    });
  }

  logger.info({ validationId, selectedPath }, "[Erector] path selected");
  return { success: true };
}

async function handleErectorFirstWeekGenerated(data: WorkerJobData): Promise<WorkerResult> {
  const validationId = validationIdFrom(data);
  if (!validationId) {
    return { success: false, retryable: false, reason: "Missing validation id" };
  }

  const taskCount = Number(data.payload.task_count ?? data.payload.taskCount ?? 0);
  const smokeTestCount = Number(data.payload.smoke_test_count ?? data.payload.smokeTestCount ?? 0);

  const [row] = await db
    .select({ first_week_plan: validations.first_week_plan })
    .from(validations)
    .where(eq(validations.id, validationId))
    .limit(1);

  if (!row?.first_week_plan) {
    return { success: false, retryable: true, reason: "first_week_plan not yet stored" };
  }

  if (data.blueprintId && data.userId) {
    await logValidationStage({
      validationId,
      blueprintId: data.blueprintId,
      userId: data.userId,
      stage: "FIRST_WEEK",
      status: "COMPLETED",
      message: "First week plan stored",
      payload: { task_count: taskCount, smoke_test_count: smokeTestCount },
    });
  }

  logger.info({ validationId, taskCount, smokeTestCount }, "[Erector] first week generated");
  return { success: true };
}

async function handleErectorBlueprintLaunched(data: WorkerJobData): Promise<WorkerResult> {
  const blueprintId = data.blueprintId ?? (data.payload.blueprint_id as string | undefined);
  if (!blueprintId || !data.userId) {
    return { success: false, retryable: false, reason: "Missing blueprint context" };
  }

  const [{ smokeCount }] = await db
    .select({ smokeCount: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.generation_reason, "erector_first_week_seed"),
      ),
    );

  const count = smokeCount ?? 0;
  if (count < 7) {
    logger.warn({ blueprintId, smokeCount: count }, "[Erector] expected 7 smoke test orders");
  }

  const [bp] = await db
    .select({
      primary_archetype_id: blueprints.primary_archetype_id,
      reality_score: blueprints.reality_score,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  if (!bp?.primary_archetype_id || bp.reality_score == null) {
    return {
      success: false,
      retryable: true,
      reason: "Archetype intel not locked on blueprint",
    };
  }

  logger.info(
    { blueprintId, smokeTestOrders: count, archetypeLocked: true },
    "[Erector] blueprint launched telemetry",
  );
  return { success: true };
}

function registerErectorWorker(
  name: string,
  queue: string,
  handler: (data: WorkerJobData) => Promise<WorkerResult>,
  options?: { localConcurrency?: number },
): void {
  workerRegistry.register({
    name,
    queue,
    options: {
      localConcurrency: options?.localConcurrency ?? 1,
      pollingIntervalSeconds: 2,
    },
    handler: async (jobs) => {
      for (const job of jobs) {
        await handleWorkerJob(job, name, handler);
      }
    },
  });
}

registerErectorWorker(
  "ErectorValidationStartedWorker",
  EventTypes.ERECTOR_VALIDATION_STARTED,
  handleErectorValidationStarted,
);
registerErectorWorker("ArchetypeResolvedWorker", EventTypes.ARCHETYPE_RESOLVED, handleArchetypeResolved);
registerErectorWorker(
  "ErectorEngineCompletedWorker",
  EventTypes.ERECTOR_ENGINE_COMPLETED,
  handleErectorEngineCompleted,
  { localConcurrency: 2 },
);
registerErectorWorker(
  "ErectorValidationCompletedWorker",
  EventTypes.ERECTOR_VALIDATION_COMPLETED,
  handleErectorValidationCompleted,
);
registerErectorWorker("ErectorPathSelectedWorker", EventTypes.ERECTOR_PATH_SELECTED, handleErectorPathSelected);
registerErectorWorker(
  "ErectorFirstWeekGeneratedWorker",
  EventTypes.ERECTOR_FIRST_WEEK_GENERATED,
  handleErectorFirstWeekGenerated,
);
registerErectorWorker(
  "ErectorBlueprintLaunchedWorker",
  EventTypes.ERECTOR_BLUEPRINT_LAUNCHED,
  handleErectorBlueprintLaunched,
);
