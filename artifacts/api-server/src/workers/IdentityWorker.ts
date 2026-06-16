import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import { evaluateIdentity } from "../engines/identity/IdentityEngine.js";

export const IDENTITY_QUEUE = "identity_evaluation_requested";

workerRegistry.register({
  name: "IdentityWorker",
  queue: IDENTITY_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 3 },
  handler: async jobs => {
    for (const job of jobs) {
      await handleWorkerJob(job, "IdentityWorker", async data => {
        const { userId, blueprintId, payload } = data;
        if (!userId || !blueprintId) {
          return { success: false, retryable: false, reason: "Missing userId or blueprintId" };
        }
        const sourceFeedbackId =
          typeof payload["source_feedback_id"] === "string"
            ? (payload["source_feedback_id"] as string)
            : undefined;

        const result = await evaluateIdentity({
          userId,
          blueprintId,
          sourceFeedbackId,
          windowDays:
            typeof payload["window_days"] === "number"
              ? (payload["window_days"] as number)
              : 14,
          reason:
            typeof payload["reason"] === "string"
              ? (payload["reason"] as string)
              : "identity_evaluation_requested",
        });

        logger.info(
          {
            blueprintId,
            stage: result.stage,
            changed: result.changed,
            held: result.held,
            regressionRisk: result.regressionRisk,
          },
          "[IdentityWorker] Done",
        );

        return { success: true };
      });
    }
  },
});
