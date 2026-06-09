import { workerRegistry } from "./WorkerRegistry.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { logger } from "../lib/logger.js";

export const EVENT_DISPATCH_POLL_QUEUE = "event_dispatch_poll";

/** Cloudflare cron: cap subrequests per scheduled invocation. */
const MAX_EVENTS_PER_CRON_TICK = 5;

const POLL_MS = 5_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

async function pollOnce(maxEvents = MAX_EVENTS_PER_CRON_TICK): Promise<number> {
  if (pollInFlight) return 0;
  pollInFlight = true;
  try {
    const dispatched = await dispatchPendingEvents(maxEvents);
    if (dispatched > 0) {
      logger.debug({ dispatched }, "[EventDispatcherWorker] Batch dispatched");
    }
    return dispatched;
  } finally {
    pollInFlight = false;
  }
}

workerRegistry.register({
  name: "EventDispatcherWorker",
  queue: EVENT_DISPATCH_POLL_QUEUE,
  options: { localConcurrency: 1, pollingIntervalSeconds: 1 },
  handler: async (jobs) => {
    let eventsDispatched = 0;
    for (const _job of jobs) {
      if (eventsDispatched >= MAX_EVENTS_PER_CRON_TICK) break;
      const remaining = MAX_EVENTS_PER_CRON_TICK - eventsDispatched;
      const dispatched = await pollOnce(remaining);
      eventsDispatched += dispatched;
      if (dispatched === 0) break;
    }
  },
});

/** Continuous 5-second event dispatch poll (Phase 2). */
export function startEventDispatcherPoll(): void {
  if (pollTimer) return;
  void pollOnce(MAX_EVENTS_PER_CRON_TICK).catch((err) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      "[EventDispatcherWorker] Initial poll failed",
    );
  });
  pollTimer = setInterval(() => {
    void pollOnce(MAX_EVENTS_PER_CRON_TICK).catch((err) => {
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
