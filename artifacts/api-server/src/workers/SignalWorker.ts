import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { calculate } from "../engines/signal/SignalCalculationEngine.js";
import { runFrameworkCycle } from "../engines/framework/FrameworkActivationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";

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

        const [bpStatus] = await db
          .select({ status: blueprints.status })
          .from(blueprints)
          .where(eq(blueprints.id, blueprintId))
          .limit(1);

        if (bpStatus?.status === "paused" || bpStatus?.status === "complete") {
          logger.info({ blueprintId, status: bpStatus.status }, "[SignalWorker] Skipping — blueprint paused or complete");
          return { success: true };
        }

        const result = await calculate({
          blueprintId,
          userId,
          causationEventId: data.eventId,
        });

        await runFrameworkCycle({
          blueprintId,
          userId,
          signalSnapshotId: result.snapshotId,
        }).catch((error: unknown) => {
          logger.warn(
            {
              blueprintId,
              error: error instanceof Error ? error.message : String(error),
            },
            "[SignalWorker] Framework cycle failed — non-critical",
          );
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
