import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const PROJECTION_QUEUE = "projection_refresh_requested";

workerRegistry.register({
  name: "ProjectionWorker",
  queue: PROJECTION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ProjectionWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[ProjectionWorker] Stub — implemented in Prompt 15");
        // TODO (Prompt 15+): DashboardService.refreshProjection(data.blueprintId)
        return { success: true };
      });
    }
  },
});
