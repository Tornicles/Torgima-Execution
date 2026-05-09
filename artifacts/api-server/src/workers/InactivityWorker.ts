import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { logger } from "../lib/logger.js";

export const INACTIVITY_QUEUE = "inactivity_scan_requested";

workerRegistry.register({
  name: "InactivityWorker",
  queue: INACTIVITY_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "InactivityWorker", async () => {
        const result = await scanForInactivity();
        logger.info(result, "[InactivityWorker] Scan complete");
        return { success: true };
      });
    }
  },
});
