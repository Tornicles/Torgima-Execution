import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { evaluate } from "../engines/condition/ConditionEvaluationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";

export const CONDITION_QUEUE = "condition_evaluation_requested";

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
