import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db } from "@workspace/db";
import { systemHealthLogs } from "@workspace/db";
import { logger } from "../lib/logger.js";

export const HEALTH_QUEUE = "system_health_event";

workerRegistry.register({
  name: "HealthWorker",
  queue: HEALTH_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 30 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "HealthWorker", async (data) => {
        logger.warn({ blueprintId: data.blueprintId, payload: data.payload }, "[HealthWorker] System health event received");

        await db
          .insert(systemHealthLogs)
          .values({
            blueprint_id: data.blueprintId as unknown as undefined,
            check_type: (data.payload as Record<string, unknown>)["check_type"] as string ?? "health_event",
            status: "degraded",
            details_json: data.payload as Record<string, unknown>,
          })
          .catch(() => null);

        return { success: true };
      });
    }
  },
});
