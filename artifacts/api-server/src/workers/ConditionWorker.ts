import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const CONDITION_QUEUE = "condition_evaluation_requested";

workerRegistry.register({
  name: "ConditionWorker",
  queue: CONDITION_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ConditionWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[ConditionWorker] Stub — implemented in Prompt 7");
        // TODO (Prompt 7+): ConditionEvaluationEngine.evaluate(data.blueprintId)
        return { success: true };
      });
    }
  },
});
