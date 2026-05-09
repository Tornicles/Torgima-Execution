import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db, signalSnapshots } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

// SignalWorker — bridges signal_recalculation_requested to a placeholder
// signal_snapshots row, then emits signal_calculated which routes through
// the dispatcher to the condition_evaluation_requested queue.
//
// The full SignalCalculationEngine lands in a later prompt; this worker keeps
// the chain alive with deterministic placeholder values so integrity checks
// pass and the loop never goes empty.
//
// Spec: Prompt 6 §STEP 3 (SignalWorker), DOC_04 §6.

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
          return { success: false, retryable: false, reason: "Missing blueprintId" };
        }

        const now = new Date();
        const windowStart = new Date(now.getTime() - 7 * 24 * 3600000);

        // Deactivate previous current snapshot
        await db
          .update(signalSnapshots)
          .set({ is_current: false })
          .where(
            and(
              eq(signalSnapshots.blueprint_id, blueprintId),
              eq(signalSnapshots.is_current, true),
            ),
          );

        // Insert new snapshot — placeholder values, real calculation lands in Prompt 7.
        const [snapshot] = await db
          .insert(signalSnapshots)
          .values({
            blueprint_id: blueprintId,
            user_id: userId,
            window_start: windowStart,
            window_end: now,
            completion_rate: 0.5,
            weighted_score: 5.0,
            momentum: 1,
            trend: "stable",
            confidence: "low",
            assigned_condition: "urgency",
            is_current: true,
            causation_event_id: data.eventId as unknown as undefined,
          })
          .returning({ id: signalSnapshots.id });

        if (!snapshot) {
          return { success: false, retryable: true, reason: "Failed to create signal snapshot" };
        }

        await incrementStateVersion(blueprintId, "signal_recalculated", data.eventId);

        // Continue the chain — signal_calculated routes to the condition queue.
        await writeEvent({
          eventType: EVENT_TYPES.SIGNAL_CALCULATED,
          entityType: "signal_snapshot",
          entityId: snapshot.id,
          userId,
          blueprintId,
          payload: { signal_snapshot_id: snapshot.id },
          idempotencyKey: `condition_eval:${blueprintId}:${snapshot.id}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, snapshotId: snapshot.id },
          "[SignalWorker] Signal snapshot created (stub)",
        );
        return { success: true };
      });
    }
  },
});
