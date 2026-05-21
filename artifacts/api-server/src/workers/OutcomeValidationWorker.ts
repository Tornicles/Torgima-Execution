import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import { outcomeValidationEngine } from "../engines/outcome/OutcomeValidationEngine.js";

export const OUTCOME_VALIDATION_QUEUE = "outcome_validation_requested";

workerRegistry.register({
  name: "OutcomeValidationWorker",
  queue: OUTCOME_VALIDATION_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 3 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "OutcomeValidationWorker", async (data) => {
        const { userId, blueprintId, payload } = data;
        if (!userId || !blueprintId) {
          return { success: false, retryable: false, reason: "Missing userId or blueprintId" };
        }

        const phase =
          typeof payload["phase"] === "string" ? (payload["phase"] as string) : undefined;
        const trigger =
          typeof payload["trigger"] === "string"
            ? (payload["trigger"] as string)
            : "outcome_validation_requested";

        const result = await outcomeValidationEngine.validate({
          userId,
          blueprintId,
          phase,
          trigger,
        });

        logger.info(
          { blueprintId, ...result },
          "[OutcomeValidationWorker] Done",
        );

        return { success: true };
      });
    }
  },
});
