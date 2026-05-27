import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { PredictiveIntelligenceService } from "../bhudhi/PredictiveIntelligenceService.js";
import { logger } from "../lib/logger.js";

export const PREDICTION_QUEUE = "prediction_requested";

workerRegistry.register({
  name: "PredictionWorker",
  queue: PREDICTION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "PredictionWorker", async (data) => {
        const blueprintId = data.blueprintId;
        const userId = data.userId;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const payload = data.payload as {
          signal_snapshot_id?: string;
        } | undefined;

        const result = await PredictiveIntelligenceService.computeAndPersist({
          userId,
          blueprintId,
          signalSnapshotId: payload?.signal_snapshot_id,
        });

        logger.info(
          {
            blueprintId,
            recommendedAction: result.recommendedAction,
            confidence: result.confidence,
          },
          "[PredictionWorker] Prediction snapshot stored",
        );
        return { success: true };
      });
    }
  },
});
