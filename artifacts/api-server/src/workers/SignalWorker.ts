import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { calculate } from "../engines/signal/SignalCalculationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

export const SIGNAL_QUEUE = "signal_recalculation_requested";

workerRegistry.register({
  name: "SignalWorker",
  queue: SIGNAL_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "SignalWorker", async (data) => {
        const { blueprintId, userId } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const result = await calculate({
          blueprintId,
          userId,
          causationEventId: data.eventId,
        });

        await incrementStateVersion(blueprintId, "signal_recalculated", data.eventId);

        await writeEvent({
          eventType: EVENT_TYPES.SIGNAL_CALCULATED,
          entityType: "signal_snapshot",
          entityId: result.snapshotId,
          userId,
          blueprintId,
          payload: {
            signal_snapshot_id: result.snapshotId,
            assigned_condition: result.condition,
            completion_rate: result.metrics.completion_rate,
            weighted_score: result.metrics.weighted_score,
            momentum: result.metrics.momentum,
            trend: result.metrics.trend,
            confidence: result.metrics.confidence,
          },
          idempotencyKey: `condition_eval:${blueprintId}:${result.snapshotId}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, condition: result.condition, snapshotId: result.snapshotId },
          "[SignalWorker] Complete",
        );
        return { success: true };
      });
    }
  },
});
