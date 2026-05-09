import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const CONTROL_QUEUE = "enforcement_package_requested";

workerRegistry.register({
  name: "ControlWorker",
  queue: CONTROL_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ControlWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[ControlWorker] Stub — implemented in Prompt 7");
        // TODO (Prompt 7+): ControlEngine.generateEnforcementPackage(data.blueprintId)
        return { success: true };
      });
    }
  },
});
