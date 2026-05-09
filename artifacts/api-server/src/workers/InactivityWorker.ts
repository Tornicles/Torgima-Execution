import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const INACTIVITY_QUEUE = "inactivity_scan_requested";

workerRegistry.register({
  name: "InactivityWorker",
  queue: INACTIVITY_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "InactivityWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[InactivityWorker] Stub — implemented in Prompt 8");
        // TODO (Prompt 8+): InactivityDetectionEngine.scan(data.blueprintId)
        return { success: true };
      });
    }
  },
});
