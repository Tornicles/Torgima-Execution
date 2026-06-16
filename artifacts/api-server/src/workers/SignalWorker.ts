import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { calculate } from "../engines/signal/SignalCalculationEngine.js";
import { runFrameworkCycle } from "../engines/framework/FrameworkActivationEngine.js";
import { calculateFrameworkSignals } from "../engines/framework/FrameworkSignalCalculator.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";
import { aggregateAndPersistTeamSignal } from "../engines/blueprint/infrastructure/TeamSignalAggregationService.js";
import { scanPatterns } from "../engines/pattern/PatternLearningEngine.js";

import { WorkerQueues } from "../types/eventContracts.js";

export const SIGNAL_QUEUE = WorkerQueues.SIGNAL_RECALCULATION;

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

        const loopPayload = data.payload as { execution_loop?: string } | undefined;
        const executionLoop =
          loopPayload?.execution_loop === "daily" ? "daily" : "primary";

        const loopPayloadReason =
          typeof loopPayload === "object" && loopPayload !== null
            ? String((loopPayload as { reason?: string }).reason ?? "")
            : "";
        const payloadReason =
          data.payload && typeof data.payload === "object"
            ? String((data.payload as { reason?: string }).reason ?? "")
            : "";

        const result = await calculate({
          blueprintId,
          userId,
          causationEventId: data.eventId,
          executionLoop,
          triggerReason: payloadReason || loopPayloadReason || undefined,
        });

        await calculateFrameworkSignals(blueprintId, userId, result.snapshotId).catch(
          () => null,
        );

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

        await writeEvent({
          eventType: EVENT_TYPES.FALSE_PROGRESS_SCAN_REQUESTED,
          entityType: "signal_snapshot",
          entityId: result.snapshotId,
          userId,
          blueprintId,
          payload: { signal_snapshot_id: result.snapshotId },
          idempotencyKey: `false_progress_scan:${blueprintId}:${result.snapshotId}`,
          causationEventId: data.eventId,
        });

        await incrementStateVersion(blueprintId, "signal_recalculated", data.eventId);

        await recordOperatingLoopStage({
          blueprintId,
          userId,
          stage: "SIGNAL_MATHEMATICS_COMPUTED",
          description: `Signal snapshot ${result.snapshotId}: condition ${result.condition}; stability n=${result.operationalMathematics.scores.stability_score.normalized.toFixed(2)}.`,
          causationEventId: data.eventId,
          triggerEventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
          entityType: "signal_snapshot",
          entityId: result.snapshotId,
          correlation: {
            signal_snapshot_id: result.snapshotId,
            assigned_condition: result.condition,
          },
        }).catch(() => null);

        await aggregateAndPersistTeamSignal(blueprintId).catch(() => null);

        await scanPatterns({ userId, blueprintId, windowDays: 14 }).catch(() => null);

        await writeEvent({
          eventType: EVENT_TYPES.PREDICTION_REQUESTED,
          entityType: "signal_snapshot",
          entityId: result.snapshotId,
          userId,
          blueprintId,
          payload: {
            blueprintId,
            userId,
            signal_snapshot_id: result.snapshotId,
          },
          idempotencyKey: `prediction:${blueprintId}:${result.snapshotId}`,
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
