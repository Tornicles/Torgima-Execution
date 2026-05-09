import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const TASK_GENERATION_QUEUE = "task_generation_requested";

workerRegistry.register({
  name: "TaskGenerationWorker",
  queue: TASK_GENERATION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "TaskGenerationWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[TaskGenerationWorker] Stub — implemented in Prompt 8");
        // TODO (Prompt 8+): TaskGenerationEngine.generate(data.blueprintId, data.payload)
        return { success: true };
      });
    }
  },
});
