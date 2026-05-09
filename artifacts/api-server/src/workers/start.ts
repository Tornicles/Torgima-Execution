import { workerRegistry } from "./WorkerRegistry.js";
import { dispatchPendingEvents } from "../services/EventDispatcher.js";
import { logger } from "../lib/logger.js";

// Import all workers to register them
import "./SignalWorker.js";
import "./ConditionWorker.js";
import "./ControlWorker.js";
import "./TaskGenerationWorker.js";
import "./FeedbackWorker.js";
import "./IdentityWorker.js";
import "./RewardWorker.js";
import "./InactivityWorker.js";
import "./NotificationWorker.js";
import "./ProjectionWorker.js";
import "./BhudhiWorker.js";
import "./HealthWorker.js";
import { startScheduledHealthChecks } from "./HealthWorker.js";
import { scanForInactivity } from "../engines/inactivity/InactivityDetectionEngine.js";
import { scanPatterns } from "../engines/pattern/PatternLearningEngine.js";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  checkAutomaticPivotTrigger,
  evaluatePivotEligibility,
  generatePivotPathOptions,
} from "../engines/strategy/StrategyEngine.js";
import { createPivotReview } from "../engines/lifecycle/PivotEngine.js";

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

  setInterval(async () => {
    try {
      const activeBlueprints = await db
        .select({ id: blueprints.id, user_id: blueprints.user_id })
        .from(blueprints)
        .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));

      for (const bp of activeBlueprints) {
        await scanPatterns({
          userId:      bp.user_id,
          blueprintId: bp.id,
          windowDays:  7,
        }).catch(() => null);
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "[PatternScheduler] Scan failed",
      );
    }
  }, 60 * 60 * 1000);
  logger.info("[Pattern] Scheduled pattern scans started (every hour)");

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
