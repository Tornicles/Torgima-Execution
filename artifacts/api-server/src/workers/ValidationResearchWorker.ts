import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { ValidationResearchEngine } from "../engines/erector/ValidationResearchEngine.js";
import type { ValidationRunInput } from "../engines/erector/ValidationResearchEngine.js";
import { logger } from "../lib/logger.js";

export const VALIDATION_RUN_QUEUE = "validation_run_requested";

workerRegistry.register({
  name: "ValidationResearchWorker",
  queue: VALIDATION_RUN_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ValidationResearchWorker", async (data) => {
        const payload = data.payload as {
          run_id?: string;
          user_id?: string;
          input?: ValidationRunInput;
        };
        const runId = payload?.run_id ?? data.entityId;
        const userId = payload?.user_id ?? data.userId;
        const input = payload?.input;

        if (!runId || !userId || !input) {
          return { success: false, retryable: false, reason: "Missing validation run context" };
        }

        const engine = new ValidationResearchEngine();
        await engine.runFullValidation({ ...input, user_id: userId, run_id: runId });

        logger.info({ runId, userId }, "[ValidationResearchWorker] Completed");
        return { success: true };
      });
    }
  },
});
