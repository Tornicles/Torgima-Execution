import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { refreshDashboardIntelligence } from "../engines/dashboard/DashboardIntelligenceEngine.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";

export const PROJECTION_QUEUE = WorkerQueues.PROJECTION_REFRESH;

workerRegistry.register({
  name: "ProjectionWorker",
  queue: PROJECTION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ProjectionWorker", async (data) => {
        const { blueprintId, userId } = data;
        if (userId) {
          await refreshDashboardIntelligence(userId, "PRIMARY_LOOP_COMPLETE").catch(() => null);
        }
        logger.info({ blueprintId, userId }, "[ProjectionWorker] Dashboard intelligence refreshed");
        return { success: true };
      });
    }
  },
});
