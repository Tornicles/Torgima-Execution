import { db, deadLetterEvents } from "@workspace/db";
import { eq } from "drizzle-orm";
import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";

export const DEAD_LETTER_REVIEW_QUEUE = "dead_letter_review_requested";

workerRegistry.register({
  name: "DeadLetterReviewWorker",
  queue: DEAD_LETTER_REVIEW_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 15 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "DeadLetterReviewWorker", async () => {
        const open = await db
          .select()
          .from(deadLetterEvents)
          .where(eq(deadLetterEvents.resolved, false))
          .limit(50);

        for (const dl of open) {
          if (dl.blueprint_id && dl.user_id) {
            await writeEvent({
              eventType: EVENT_TYPES.SYSTEM_HEALTH_DEGRADED,
              entityType: "dead_letter_event",
              entityId: dl.id,
              userId: dl.user_id,
              blueprintId: dl.blueprint_id,
              payload: {
                issue_code: "DLQ_OPEN",
                event_type: dl.event_type,
                failure_reason: dl.failure_reason,
              },
              idempotencyKey: `dlq_review:${dl.id}:${Math.floor(Date.now() / 1800000)}`,
            }).catch(() => null);
          }
        }

        logger.info({ count: open.length }, "[DeadLetterReview] Open DLQ items reviewed");
        return { success: true };
      });
    }
  },
});
