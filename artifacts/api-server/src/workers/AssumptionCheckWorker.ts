import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { checkAssumptionDrift } from "../engines/validation/AssumptionMonitoringService.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";

export const ASSUMPTION_CHECK_QUEUE = "assumption_check_requested";

workerRegistry.register({
  name: "AssumptionCheckWorker",
  queue: ASSUMPTION_CHECK_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 10 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "AssumptionCheckWorker", async (data) => {
        if (!data.blueprintId || !data.userId) {
          return { success: false, retryable: false, reason: "Missing blueprint or user" };
        }
        const warnings = await checkAssumptionDrift({
          userId: data.userId,
          blueprintId: data.blueprintId,
        });
        if (warnings.length > 0) {
          await writeEvent({
            eventType: EVENT_TYPES.DASHBOARD_REFRESH_REQUESTED,
            entityType: "blueprint",
            entityId: data.blueprintId,
            userId: data.userId,
            blueprintId: data.blueprintId,
            payload: { reason: "assumption_drift", warnings },
            idempotencyKey: `assumption_drift:${data.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
          }).catch(() => null);
        }
        return { success: true };
      });
    }
  },
});
