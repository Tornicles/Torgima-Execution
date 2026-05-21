import { workerRegistry } from "./WorkerRegistry.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { logger } from "../lib/logger.js";

// Import all workers to register them
import "./SignalWorker.js";
import "./ConditionWorker.js";
import "./ControlWorker.js";
import "./TaskGenerationWorker.js";
import "./TaskGuaranteeWorker.js";
import "./FeedbackWorker.js";
import "./IdentityWorker.js";
import "./RewardWorker.js";
import "./OutcomeValidationWorker.js";
import "./InactivityWorker.js";
import "./NotificationWorker.js";
import "./ProjectionWorker.js";
import "./BhudhiWorker.js";
import "./HealthWorker.js";
import "./ValidationQueueWorker.js";
import "./PatternScanWorker.js";
import "./AssumptionCheckWorker.js";
import "./DeadLetterReviewWorker.js";
import { startCalendarNotificationPoller } from "./CalendarNotificationWorker.js";
import { startNotificationDeliveryPoller } from "./NotificationDeliveryWorker.js";
import { startAnalyticsPoller } from "./AnalyticsWorker.js";
import { startIntegrationsSyncPoller } from "./IntegrationsSyncWorker.js";
import { startProfilePledgePoller } from "./ProfilePledgeWorker.js";
import { startScheduledHealthChecks } from "./HealthWorker.js";
import { startProductionSchedulers } from "../schedulers/ProductionScheduler.js";
import { startBhudhiPhase1Schedulers } from "../schedulers/BhudhiPhase1Scheduler.js";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  checkAutomaticPivotTrigger,
  evaluatePivotEligibility,
  generatePivotPathOptions,
} from "../engines/strategy/StrategyEngine.js";
import { createPivotReview } from "../engines/lifecycle/PivotEngine.js";
import { processDeferredNotifications } from "../services/NotificationService.js";
import { startExecutionContinuitySchedulers } from "../schedulers/ExecutionContinuityScheduler.js";

export async function startWorkers(): Promise<void> {
  logger.info("[Workers] Starting all workers...");
  await workerRegistry.startAll();

  startScheduledHealthChecks();
  startExecutionContinuitySchedulers();
  startProductionSchedulers();
  startBhudhiPhase1Schedulers();
  startCalendarNotificationPoller();
  startNotificationDeliveryPoller();
  startAnalyticsPoller();
  startIntegrationsSyncPoller();
  startProfilePledgePoller();

  setInterval(async () => {
    try {
      const activeBlueprints = await db
        .select({ id: blueprints.id, user_id: blueprints.user_id })
        .from(blueprints)
        .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

      for (const bp of activeBlueprints) {
        const shouldTrigger = await checkAutomaticPivotTrigger({ blueprintId: bp.id, userId: bp.user_id });
        if (!shouldTrigger) continue;
        const eligibility = await evaluatePivotEligibility({
          blueprintId: bp.id,
          userId: bp.user_id,
          triggerType: "automatic",
        });
        if (!eligibility.eligible) continue;
        const reviewId = await createPivotReview({
          blueprintId: bp.id,
          userId: bp.user_id,
          triggerType: "automatic",
          triggerReason: "Sustained condition failure detected",
        });
        await generatePivotPathOptions({
          blueprintId: bp.id,
          userId: bp.user_id,
          pivotReviewId: reviewId,
        }).catch(() => null);
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[PivotScheduler] Check failed",
      );
    }
  }, 6 * 60 * 60 * 1000);
  logger.info("[Pivot] Scheduled pivot eligibility check started (every 6 hours)");

  setInterval(async () => {
    try {
      const count = await processDeferredNotifications();
      if (count > 0) {
        logger.info({ count }, "[Notifications] Processed deferred notifications");
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[Notifications] Deferred processing failed",
      );
    }
  }, 10 * 60 * 1000);
  logger.info("[Notifications] Deferred notification processor started (every 10 minutes)");

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
