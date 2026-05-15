import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { calculate } from "../engines/signal/SignalCalculationEngine.js";
import type { OperationalMathematicsDocument } from "../engines/signal/SignalOperationalMathematicsEngine.js";
import { runFrameworkCycle } from "../engines/framework/FrameworkActivationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";

export const SIGNAL_QUEUE = "signal_recalculation_requested";

function operationalMathExcerpt(om: OperationalMathematicsDocument): Record<string, unknown> {
  const s = om.scores;
  return {
    completion_rate: { value: s.completion_rate.value, n: s.completion_rate.normalized },
    stability_score: { value: s.stability_score.value, n: s.stability_score.normalized },
    dependency_pressure: { value: s.dependency_pressure.value, n: s.dependency_pressure.normalized },
    proof_reliability: { value: s.proof_reliability.value, n: s.proof_reliability.normalized },
    strategic_alignment: { value: s.strategic_alignment.value, n: s.strategic_alignment.normalized },
    signal_volatility: { value: s.signal_volatility.value, n: s.signal_volatility.normalized },
    consequenceDeltas: om.consequenceDeltas,
    adaptation_excerpt: om.adaptationExplanation.slice(0, 280),
    schemaVersion: om.schemaVersion,
  };
}

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
            operational_mathematics_excerpt: operationalMathExcerpt(result.operationalMathematics),
          },
          idempotencyKey: `condition_eval:${blueprintId}:${result.snapshotId}`,
          causationEventId: data.eventId,
        });

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

        logger.info(
          { blueprintId, condition: result.condition, snapshotId: result.snapshotId },
          "[SignalWorker] Complete",
        );
        return { success: true };
      });
    }
  },
});
