import { workerRegistry } from "./WorkerRegistry.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { logger } from "../lib/logger.js";

// Import all workers to register them
import "./SignalWorker.js";
import "./ConditionWorker.js";
import "./ControlWorker.js";
import "./TaskGenerationWorker.js";
import "./FeedbackWorker.js";
import "./InactivityWorker.js";
import "./NotificationWorker.js";
import "./ProjectionWorker.js";
import "./BhudhiWorker.js";
import "./HealthWorker.js";
import { startScheduledHealthChecks } from "./HealthWorker.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";

export async function startWorkers(): Promise<void> {
  logger.info("[Workers] Starting all workers...");
  await workerRegistry.startAll();

  startScheduledHealthChecks();

  setInterval(async () => {
    try {
      await scanForInactivity();
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[InactivityScheduler] Scan failed",
      );
    }
  }, 15 * 60 * 1000);
  logger.info("[Inactivity] Scheduled scan started (every 15 minutes)");

  // Event dispatcher polling loop
  logger.info("[EventDispatcher] Starting dispatcher loop...");
  setInterval(async () => {
    try {
      const dispatched = await dispatchPendingEvents();
      if (dispatched > 0) {
        logger.debug(`[EventDispatcher] Dispatched ${dispatched} events`);
      }
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "[EventDispatcher] Dispatch cycle failed",
      );
    }
  }, 1000);

  logger.info("[Workers] All workers running.");
}
