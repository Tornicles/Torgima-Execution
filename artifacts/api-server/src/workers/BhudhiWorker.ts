import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob, type WorkerJobData } from "./BaseWorkerHandler.js";
import { routeBhudhiRequest } from "../bhudhi/TriggerRouter.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { logger } from "../lib/logger.js";

export const BHUDHI_QUEUE = "bhudhi_trigger_requested";

workerRegistry.register({
  name:    "BhudhiWorker",
  queue:   BHUDHI_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 5 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "BhudhiWorker", async (data: WorkerJobData) => {
        const { userId, blueprintId, payload } = data;
        if (!userId) return { success: false, retryable: false, reason: "Missing userId" };

        const triggerType = payload?.["trigger_type"] as BhudhiTriggerType | undefined;
        if (!triggerType) return { success: false, retryable: false, reason: "Missing trigger_type" };

        const result = await routeBhudhiRequest({
          sourceEngine:   String(payload?.["source_engine"] ?? "worker"),
          triggerType,
          userId,
          blueprintId,
          stateVersion:   Number(payload?.["state_version"] ?? 0),
          userInput:      payload?.["user_input"] as string | undefined,
          facts:          (payload?.["facts"] as Record<string, unknown>) ?? {},
          idempotencyKey: data.eventId ?? `bhudhi:${Date.now()}`,
        });

        logger.info(
          { triggerType, userId, ok: result.ok, fallbackUsed: result.fallbackUsed },
          "[BhudhiWorker] Trigger processed",
        );

        return { success: true };
      });
    }
  },
});
