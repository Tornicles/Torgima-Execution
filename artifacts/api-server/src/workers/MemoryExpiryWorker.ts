import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { BhudhiMemoryService } from "../bhudhi/BhudhiMemoryService.js";
import { logger } from "../lib/logger.js";

export const MEMORY_EXPIRY_QUEUE = "memory_expiry_scan";

workerRegistry.register({
  name: "MemoryExpiryWorker",
  queue: MEMORY_EXPIRY_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 60 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "MemoryExpiryWorker", async () => {
        const count = await BhudhiMemoryService.expireOldMemory();
        logger.info({ count }, "[MemoryExpiryWorker] Expired stale memories");
        return { success: true };
      });
    }
  },
});
