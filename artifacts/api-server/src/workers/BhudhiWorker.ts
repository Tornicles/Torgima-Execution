import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const BHUDHI_QUEUE = "bhudhi_trigger_requested";

workerRegistry.register({
  name: "BhudhiWorker",
  queue: BHUDHI_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 5 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "BhudhiWorker", async (data) => {
        logger.info(
          { blueprintId: data.blueprintId, triggerType: (data.payload as Record<string, unknown>)["trigger_type"] },
          "[BhudhiWorker] Stub — implemented in Prompt 9",
        );
        // TODO (Prompt 9+): BhudhiCore.trigger(data.payload)
        return { success: true };
      });
    }
  },
});
