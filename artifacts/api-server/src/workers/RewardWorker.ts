import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { logger } from "../lib/logger.js";
import { evaluateReward } from "../engines/reward/RewardEngine.js";

export const REWARD_QUEUE = "reward_evaluation_requested";

workerRegistry.register({
  name: "RewardWorker",
  queue: REWARD_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async jobs => {
    for (const job of jobs) {
      await handleWorkerJob(job, "RewardWorker", async data => {
        const { userId, blueprintId, payload } = data;
        if (!userId) {
          return { success: false, retryable: false, reason: "Missing userId" };
        }

        const sourceType = String(payload["source_type"] ?? "");
        const sourceId = String(payload["source_id"] ?? "");
        const idempotencyKey = String(
          payload["idempotency_key"] ?? `reward:${sourceType}:${sourceId}`,
        );
        const stateVersion =
          typeof payload["state_version"] === "number" ? (payload["state_version"] as number) : 0;

        if (!sourceType || !sourceId) {
          return { success: false, retryable: false, reason: "Missing source_type or source_id" };
        }

        const result = await evaluateReward({
          userId,
          blueprintId,
          sourceType,
          sourceId,
          idempotencyKey,
          stateVersion,
          causationEventId: data.eventId,
        });

        logger.info(
          { userId, blueprintId, rewardCreated: result.rewardCreated, rewardType: result.rewardType },
          "[RewardWorker] Done",
        );

        return { success: true };
      });
    }
  },
});
