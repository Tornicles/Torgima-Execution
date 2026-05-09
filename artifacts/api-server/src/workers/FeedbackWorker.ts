import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";

// FeedbackWorker — bridge from feedback to signal recalculation.
// If the feedback requires interrogation, the chain is paused until the
// interrogation_answered event resumes it. Otherwise it emits
// signal_recalculation_requested.
//
// Spec: Prompt 6 §STEP 3 (FeedbackWorker), DOC_04 §5.

export const FEEDBACK_QUEUE = "feedback_processing_requested";

workerRegistry.register({
  name: "FeedbackWorker",
  queue: FEEDBACK_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "FeedbackWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        const feedbackId = (payload as Record<string, unknown> | undefined)?.["feedback_id"] as
          | string
          | undefined;

        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const requiresInterrogation = Boolean(
          (payload as Record<string, unknown> | undefined)?.["requires_interrogation"],
        );

        if (requiresInterrogation) {
          logger.info(
            { feedbackId, blueprintId },
            "[FeedbackWorker] Interrogation required — chain paused",
          );
          // Chain resumes via a separate interrogation_answered event.
          return { success: true };
        }

        await writeEvent({
          eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { trigger_feedback_id: feedbackId },
          idempotencyKey: `signal_recalc:${blueprintId}:feedback:${feedbackId ?? Date.now()}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, feedbackId },
          "[FeedbackWorker] Signal recalculation requested",
        );
        return { success: true };
      });
    }
  },
});
