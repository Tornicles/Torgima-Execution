import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import { classifyFailureWithRecord } from "../engines/failure/FailureClassificationRecord.js";
import { db, feedback } from "@workspace/db";
import { eq } from "drizzle-orm";
import { WorkerQueues } from "../types/eventContracts.js";

/** Phase 4 DOC 22 — async failure classification queue. */
export const FAILURE_QUEUE = WorkerQueues.FAILURE_CLASSIFICATION;

workerRegistry.register({
  name: "FailureWorker",
  queue: FAILURE_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "FailureWorker", async (data) => {
        const { userId, blueprintId, payload } = data;
        if (!userId || !blueprintId) {
          return { success: false, retryable: false, reason: "Missing userId or blueprintId" };
        }

        const orderId = String(payload["order_id"] ?? "");
        const feedbackId = String(payload["feedback_id"] ?? "");
        if (!orderId || !feedbackId) {
          return { success: false, retryable: false, reason: "Missing order_id or feedback_id" };
        }

        const [fb] = await db
          .select({ reflection: feedback.reflection })
          .from(feedback)
          .where(eq(feedback.id, feedbackId))
          .limit(1);

        await classifyFailureWithRecord({
          userId,
          blueprintId,
          orderId,
          feedbackId,
          reflection: fb?.reflection ?? "",
        });

        logger.info(
          { blueprintId, feedbackId, orderId },
          "[FailureWorker] Classification complete",
        );
        return { success: true };
      });
    }
  },
});
