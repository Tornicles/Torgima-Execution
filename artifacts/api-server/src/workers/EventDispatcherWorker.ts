import { workerRegistry } from "./WorkerRegistry.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { logger } from "../lib/logger.js";

export const EVENT_DISPATCH_POLL_QUEUE = "event_dispatch_poll";

const POLL_MS = 5_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

async function pollOnce(): Promise<void> {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const dispatched = await dispatchPendingEvents();
    if (dispatched > 0) {
      logger.debug({ dispatched }, "[EventDispatcherWorker] Batch dispatched");
    }
  } finally {
    pollInFlight = false;
  }
}

workerRegistry.register({
  name: "EventDispatcherWorker",
  queue: EVENT_DISPATCH_POLL_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 1 },
  handler: async (jobs) => {
    for (const _job of jobs) {
      await pollOnce();
    }
  },
});

/** Continuous 5-second event dispatch poll (Phase 2). */
export function startEventDispatcherPoll(): void {
  if (pollTimer) return;
  void pollOnce().catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[EventDispatcherWorker] Initial poll failed",
    );
  });
  pollTimer = setInterval(() => {
    void pollOnce().catch((err) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[EventDispatcherWorker] Poll failed",
      );
    });
  }, POLL_MS);
  logger.info({ pollMs: POLL_MS }, "[EventDispatcherWorker] Dispatch poll started");
}

export function stopEventDispatcherPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
