import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { BhudhiMemoryService as LegacyBhudhiMemoryService } from "../bhudhi/BhudhiMemoryService.js";
import { bhudhiMemoryService } from "../lib/bhudhi/BhudhiMemoryService.js";
import { logger } from "../lib/logger.js";

export const MEMORY_EXPIRY_QUEUE = "memory_expiry_scan";

workerRegistry.register({
  name: "MemoryExpiryWorker",
  queue: MEMORY_EXPIRY_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 60 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "MemoryExpiryWorker", async () => {
        const softCount = await LegacyBhudhiMemoryService.expireOldMemory();
        const hardCount = await bhudhiMemoryService.runDecayCleanup();
        logger.info({ softCount, hardCount }, "[MemoryExpiryWorker] Expired stale memories");
        return { success: true };
      });
    }
  },
});
