/**
 * Cloudflare Cron Trigger bridge — enqueues pg-boss cron jobs via TASK_QUEUE.
 * Cron expressions must match wrangler.jsonc triggers character-for-character.
 */

import type { ScheduledController } from "@cloudflare/workers-types";
import { bindCloudflareEnv, type TorgimaWorkerEnv } from "../lib/cloudflare-runtime.js";
import { logger } from "../lib/logger.js";
import { WorkerQueues } from "../types/eventContracts.js";
import { EVENT_DISPATCH_POLL_QUEUE } from "../workers/EventDispatcherWorker.js";
import { SESSION_CLEANUP_QUEUE } from "../workers/SessionCleanupWorker.js";
import { STATE_INTEGRITY_QUEUE } from "../workers/StateIntegrityWorker.js";

const CRON_TO_QUEUE: Record<string, string> = {
  "0 2 * * *": SESSION_CLEANUP_QUEUE,
  "*/30 * * * *": WorkerQueues.INACTIVITY_CRON,
  "0 3 * * *": WorkerQueues.PATTERN_DAILY_CRON,
  "*/10 * * * *": STATE_INTEGRITY_QUEUE,
  "* * * * *": EVENT_DISPATCH_POLL_QUEUE,
};

export async function handleCloudflareCron(
  controller: ScheduledController,
  env: TorgimaWorkerEnv,
): Promise<void> {
  bindCloudflareEnv(env);

  const queue = CRON_TO_QUEUE[controller.cron];
  if (!queue) {
    logger.warn({ cron: controller.cron }, "[Cron] No queue mapping for cron expression");
    return;
  }

  const binding = env.TASK_QUEUE;
  if (!binding) {
    throw new Error("[Cron] TASK_QUEUE binding is not configured");
  }

  await binding.send({
    queue,
    payload: { trigger: "cloudflare_cron", cron: controller.cron },
  });

  logger.info({ cron: controller.cron, queue }, "[Cron] Enqueued scheduled job");
}
