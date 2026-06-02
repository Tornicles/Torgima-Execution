import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import {
  applyLoadReduction,
  generateEnforcementPackage,
} from "../engines/control/ControlEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { logger } from "../lib/logger.js";

import { WorkerQueues } from "../types/eventContracts.js";

export const CONTROL_QUEUE = WorkerQueues.ENFORCEMENT_PACKAGE;

workerRegistry.register({
  name: "ControlWorker",
  queue: CONTROL_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ControlWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const adaptationType = String(
          payload?.type ?? payload?.adaptationType ?? payload?.action ?? "",
        ).toLowerCase();

        if (adaptationType === "reduce_load") {
          const reduced = await applyLoadReduction({
            blueprintId,
            userId,
            causationEventId: data.eventId,
          });
          logger.info(
            { blueprintId, packageId: reduced.packageId },
            "[ControlWorker] Load reduction applied",
          );
          return { success: true };
        }

        const conditionId = payload?.condition_id as string | undefined;
        const condition = (payload?.condition as string | undefined) ?? "urgency";
        const escalationLevel = (payload?.escalation_level as number | undefined) ?? 0;
        const recoveryRequired = (payload?.recovery_required as boolean | undefined) ?? false;
        const snapshotId = payload?.signal_snapshot_id as string | undefined;

        if (!conditionId) {
          return { success: false, retryable: false, reason: "Missing condition_id in payload" };
        }

        const result = await generateEnforcementPackage({
          blueprintId,
          userId,
          conditionId,
          condition,
          signalSnapshotId: snapshotId,
          escalationLevel,
          recoveryRequired,
          causationEventId: data.eventId,
        });

        const generationMode = recoveryRequired ? "recovery" : "post_feedback";

        await writeEvent({
          eventType: EVENT_TYPES.ENFORCEMENT_PACKAGE_CREATED,
          entityType: "enforcement_package",
          entityId: result.packageId,
          userId,
          blueprintId,
          payload: {
            enforcement_package_id: result.packageId,
            generation_mode: generationMode,
            generation_trigger: "enforcement_package_created",
            condition,
            recovery_required: recoveryRequired,
          },
          idempotencyKey: `task_gen:${blueprintId}:${result.packageId}`,
          causationEventId: data.eventId,
        });

        await recordOperatingLoopStage({
          blueprintId,
          userId,
          stage: "ENFORCEMENT_BOUND",
          description: `Enforcement package ${result.packageId} bound (${condition}, mode=${generationMode}).`,
          causationEventId: data.eventId,
          triggerEventType: EVENT_TYPES.CONDITION_EVALUATED,
          entityType: "enforcement_package",
          entityId: result.packageId,
          correlation: { enforcement_package_id: result.packageId, recovery_required: recoveryRequired },
        }).catch(() => null);

        logger.info(
          { blueprintId, packageId: result.packageId, condition },
          "[ControlWorker] Complete",
        );
        return { success: true };
      });
    }
  },
});
