import { and, eq } from "drizzle-orm";
import { db, erectorSystemErrorRecords, erectorValidationRuns } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { runSimulationOrchestrator } from "../engines/erector/simulation/ErectorSimulationOrchestrator.js";
import { checkResimulationTriggers } from "../engines/erector/simulation/ResimulationTriggerSystem.js";
import { mapIntakeTierToMatrixTier } from "../engines/erector/ValidationScoringEngine.js";
import { EVENT_TYPES, writeEvent } from "../services/EventService.js";
import type { WorkerJobData, WorkerResult } from "./BaseWorkerHandler.js";

export async function handleErectorSimulationRequestedJob(
  data: WorkerJobData,
): Promise<WorkerResult> {
  const validationRunId =
    (data.payload.validation_run_id as string | undefined) ??
    (data.entityType === "erector_validation_run" ? data.entityId : undefined);
  const userId = data.userId;
  const blueprintId = data.blueprintId;

  if (!validationRunId || !userId || !blueprintId) {
    return { success: false, retryable: false, reason: "Missing simulation context" };
  }

  let tier = data.payload.tier as string | undefined;
  if (!tier) {
    const [run] = await db
      .select({ tier: erectorValidationRuns.tier })
      .from(erectorValidationRuns)
      .where(
        and(
          eq(erectorValidationRuns.id, validationRunId),
          eq(erectorValidationRuns.user_id, userId),
        ),
      )
      .limit(1);
    tier = run?.tier ?? "authenticated";
  }

  if (mapIntakeTierToMatrixTier(tier) === "starter") {
    return { success: true, reason: "SIMULATION_NOT_REQUIRED_FOR_STARTER" };
  }

  try {
    const result = await runSimulationOrchestrator(
      validationRunId,
      userId,
      blueprintId,
      tier,
    );
    logger.info(
      {
        validationRunId,
        simulationRunId: result.simulation_run_id,
        verdict: result.verdict,
        probabilityProceed: result.scores.probability_proceed,
      },
      "[ErectorSimulationWorker] simulation completed",
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation orchestrator failed";

    if (message === "SIMULATION_NOT_REQUIRED_FOR_STARTER") {
      return { success: true, reason: message };
    }

    await db.insert(erectorSystemErrorRecords).values({
      error_type: "SIMULATION_FAILED",
      source_engine: "ErectorSimulationWorker",
      user_id: userId,
      entity_type: "erector_validation_run",
      entity_id: validationRunId,
      error_message: message,
      recovery_action: "retry",
    });

    logger.error({ err, validationRunId, userId }, "[ErectorSimulationWorker] simulation failed");
    return { success: false, retryable: true, reason: message };
  }
}

export async function handleErectorSignalCalculatedJob(
  data: WorkerJobData,
): Promise<WorkerResult> {
  const blueprintId = data.blueprintId;
  const userId = data.userId;

  if (!blueprintId || !userId) {
    return { success: false, retryable: false, reason: "Missing simulation context" };
  }

  try {
    const triggerResult = await checkResimulationTriggers(userId, blueprintId);

    if (!triggerResult.should_resimulate) {
      return { success: true, reason: "NO_RESIMULATION_TRIGGERS" };
    }

    for (const triggerType of triggerResult.triggers) {
      await writeEvent({
        eventType: EVENT_TYPES.ERECTOR_RESIMULATION_TRIGGERED,
        entityType: "blueprint",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: {
          trigger_type: triggerType,
          trigger_description: `Resimulation triggered by ${triggerType}`,
          changed_signals: triggerResult.changed_signals,
          trigger_source: "erector_signal_calculated",
        },
        idempotencyKey: `erector_resimulation_triggered:${blueprintId}:${triggerType}:${data.eventId}`,
        causationEventId: data.eventId,
      });
    }

    logger.info(
      { blueprintId, triggers: triggerResult.triggers },
      "[ErectorSimulationWorker] Resimulation triggers emitted",
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { blueprintId, error: message },
      "[ErectorSimulationWorker] Resimulation check failed — non-blocking",
    );
    return { success: true, reason: "RESIMULATION_CHECK_FAILED_NON_BLOCKING" };
  }
}
