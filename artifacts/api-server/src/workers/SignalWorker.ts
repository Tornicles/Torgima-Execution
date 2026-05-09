import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const SIGNAL_QUEUE = "signal_recalculation_requested";

workerRegistry.register({
  name: "SignalWorker",
  queue: SIGNAL_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "SignalWorker", async (data) => {
        logger.info({ blueprintId: data.blueprintId }, "[SignalWorker] Stub — implemented in Prompt 7");
        // TODO (Prompt 7+): SignalCalculationEngine.calculate(data.blueprintId)
        return { success: true };
      });
    }
  },
});
