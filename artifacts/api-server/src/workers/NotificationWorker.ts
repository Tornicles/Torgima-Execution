import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";

export const NOTIFICATION_QUEUE = "notification_send_requested";

workerRegistry.register({
  name: "NotificationWorker",
  queue: NOTIFICATION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 10 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "NotificationWorker", async (data) => {
        logger.info(
          { userId: data.userId, notificationType: (data.payload as Record<string, unknown>)["notification_type"] },
          "[NotificationWorker] Stub — implemented in Prompt 13",
        );
        // TODO (Prompt 13+): NotificationService.deliver(data.payload)
        return { success: true };
      });
    }
  },
});
