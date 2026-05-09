import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const FEEDBACK_QUEUE = "feedback_processing_requested";

workerRegistry.register({
  name: "FeedbackWorker",
  queue: FEEDBACK_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "FeedbackWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[FeedbackWorker] Stub — implemented in Prompt 8");
        // TODO (Prompt 8+): FeedbackProcessingEngine.process(data.payload.feedbackId)
        return { success: true };
      });
    }
  },
});
