import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { evaluate } from "../engines/condition/ConditionEvaluationEngine.js";
import { onConditionChanged } from "../engines/mini-plan/MiniPlanAllocationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { logger } from "../lib/logger.js";

import { WorkerQueues } from "../types/eventContracts.js";

export const CONDITION_QUEUE = WorkerQueues.CONDITION_EVALUATION;

workerRegistry.register({
  name: "ConditionWorker",
  queue: CONDITION_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ConditionWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const signalSnapshotId = payload?.signal_snapshot_id as string | undefined;
        const assignedCondition =
          (payload?.assigned_condition as string | undefined) ?? "urgency";

        if (!signalSnapshotId) {
          return { success: false, retryable: false, reason: "Missing signal_snapshot_id in payload" };
        }

        const result = await evaluate({
          blueprintId,
          userId,
          signalSnapshotId,
          assignedCondition,
          causationEventId: data.eventId,
        });

        await writeEvent({
          eventType: EVENT_TYPES.CONDITION_EVALUATED,
          entityType: "condition",
          entityId: result.conditionId,
          userId,
          blueprintId,
          payload: {
            condition_id: result.conditionId,
            condition: result.condition,
            escalation_level: result.escalationLevel,
            recovery_required: result.recoveryRequired,
            signal_snapshot_id: signalSnapshotId,
          },
          idempotencyKey: `enforcement:${blueprintId}:${result.conditionId}:${signalSnapshotId}`,
          causationEventId: data.eventId,
        });

        if (result.conditionChanged) {
          await onConditionChanged({
            blueprintId,
            userId,
            newCondition: result.condition,
            previousCondition: result.previousCondition,
            causationEventId: data.eventId,
          }).catch((err: unknown) => {
            logger.warn(
              { blueprintId, err: err instanceof Error ? err.message : String(err) },
              "[ConditionWorker] Mini plan allocation failed",
            );
          });
        }

        await recordOperatingLoopStage({
          blueprintId,
          userId,
          stage: "CONDITION_COMMITTED",
          description: `Condition ${result.condition} committed (recovery=${result.recoveryRequired}).`,
          causationEventId: data.eventId,
          triggerEventType: EVENT_TYPES.SIGNAL_CALCULATED,
          entityType: "condition",
          entityId: result.conditionId,
          correlation: {
            condition: result.condition,
            signal_snapshot_id: signalSnapshotId,
            changed: result.conditionChanged,
          },
        }).catch(() => null);

        logger.info(
          {
            blueprintId,
            condition: result.condition,
            changed: result.conditionChanged,
            duration: result.durationDays,
          },
          "[ConditionWorker] Complete",
        );
        return { success: true };
      });
    }
  },
});
