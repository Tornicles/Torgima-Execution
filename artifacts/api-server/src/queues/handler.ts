/**
 * Cloudflare Queues consumer — dispatches to existing pg-boss worker handlers.
 */

import type { Job } from "pg-boss";
import type { MessageBatch } from "@cloudflare/workers-types";
import { bindCloudflareEnv, type TorgimaQueueMessage, type TorgimaWorkerEnv } from "../lib/cloudflare-runtime.js";
import { logger } from "../lib/logger.js";
import { workerRegistry } from "../workers/WorkerRegistry.js";

// Register worker handlers (side-effect imports — same as workers/start.ts)
import "../workers/SignalWorker.js";
import "../workers/ConditionWorker.js";
import "../workers/ControlWorker.js";
import "../workers/TaskGenerationWorker.js";
import "../workers/TaskGuaranteeWorker.js";
import "../workers/FeedbackWorker.js";
import "../workers/IdentityWorker.js";
import "../workers/RewardWorker.js";
import "../workers/OutcomeValidationWorker.js";
import "../workers/FailureWorker.js";
import "../workers/AssumptionCheckWorker.js";
import "../workers/ProjectionWorker.js";
import "../workers/BhudhiWorker.js";
import "../workers/ValidationQueueWorker.js";
import "../workers/ValidationResearchWorker.js";
import "../workers/ErectorEventWorkers.js";
import "../workers/PredictionWorker.js";
import "../workers/EISWorker.js";
import "../workers/FalseProgressWorker.js";
import "../workers/BlueprintPositionWorker.js";
import "../workers/SessionCleanupWorker.js";
import "../workers/InactivityWorker.js";
import "../workers/PatternScanWorker.js";
import "../workers/StateIntegrityWorker.js";
import "../workers/EventDispatcherWorker.js";

export async function dispatchQueueMessage(message: TorgimaQueueMessage): Promise<void> {
  const handlers = workerRegistry.getRegistered().filter((d) => d.queue === message.queue);
  if (handlers.length === 0) {
    logger.warn({ queue: message.queue }, "[Queue] No handler registered for queue");
    return;
  }

  const job = { data: message.payload } as Job<unknown>;
  for (const def of handlers) {
    await def.handler([job]);
  }
}

export async function handleQueueBatch(
  batch: MessageBatch<TorgimaQueueMessage>,
  env: TorgimaWorkerEnv,
): Promise<void> {
  bindCloudflareEnv(env);

  for (const message of batch.messages) {
    try {
      await dispatchQueueMessage(message.body);
      message.ack();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err), queue: message.body.queue },
        "[Queue] Handler failed",
      );
      message.retry();
    }
  }
}
