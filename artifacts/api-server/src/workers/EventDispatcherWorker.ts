import { workerRegistry } from "./WorkerRegistry.js";
import {
  dispatchPendingEvents,
  dispatchPendingEventsForCron,
  DISPATCH_BATCH_SIZE,
} from "../services/EventDispatcher.js";
import { isCloudflareRuntime } from "../lib/cloudflare-runtime.js";
import { logger } from "../lib/logger.js";

export const EVENT_DISPATCH_POLL_QUEUE = "event_dispatch_poll";

const POLL_MS = 5_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

function nodePollBatchSize(): number {
  return isCloudflareRuntime() ? 1 : DISPATCH_BATCH_SIZE;
}

async function pollOnce(batchSize: number): Promise<number> {
  if (pollInFlight) return 0;
  pollInFlight = true;
  try {
    return await dispatchPendingEvents(batchSize);
  } finally {
    pollInFlight = false;
  }
}

workerRegistry.register({
  name: "EventDispatcherWorker",
  queue: EVENT_DISPATCH_POLL_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 1 },
  handler: async (_jobs) => {
    logger.info({ queue: EVENT_DISPATCH_POLL_QUEUE }, "[EventDispatcherWorker] Cron dispatch started");
    await dispatchPendingEventsForCron();
  },
});

/** Continuous 5-second event dispatch poll (Phase 2 — Node server only). */
export function startEventDispatcherPoll(): void {
  if (pollTimer) return;
  const batchSize = nodePollBatchSize();
  void pollOnce(batchSize).catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[EventDispatcherWorker] Initial poll failed",
    );
  });
  pollTimer = setInterval(() => {
    void pollOnce(nodePollBatchSize()).catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[EventDispatcherWorker] Poll failed",
      );
    });
  }, POLL_MS);
  logger.info({ pollMs: POLL_MS, batchSize }, "[EventDispatcherWorker] Dispatch poll started");
}

export function stopEventDispatcherPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
