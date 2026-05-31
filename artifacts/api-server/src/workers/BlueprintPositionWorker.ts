import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";
import { buildBlueprintPositionProjection } from "../lib/buildBlueprintPositionProjection.js";

/** Refreshes blueprint position projection when targets complete (audit: BlueprintPositionWorker). */
const QUEUE = WorkerQueues.PROJECTION_REFRESH;

workerRegistry.register({
  name: "BlueprintPositionWorker",
  queue: QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "BlueprintPositionWorker", async (data) => {
        const { blueprintId, userId, eventType } = data;
        if (!blueprintId || !userId) return { success: true };
        if (eventType !== "target_completed" && eventType !== "phase_checkpoint_required") {
          return { success: true };
        }
        await buildBlueprintPositionProjection(blueprintId, userId).catch(() => null);
        logger.info({ blueprintId, eventType }, "[BlueprintPositionWorker] Position projection refreshed");
        return { success: true };
      });
    }
  },
});
