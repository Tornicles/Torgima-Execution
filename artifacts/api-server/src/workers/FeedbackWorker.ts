import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { blueprints, db, feedback, orders } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isVerifiedFeedbackEvidence } from "../engines/intelligence/IdentityContinuityEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import {
  acquireBlueprintWorkflowLock,
  releaseBlueprintWorkflowLock,
  Workflows,
} from "../services/OrchestrationService.js";
import { WorkerQueues } from "../types/eventContracts.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { validateOutcome } from "../engines/outcome/OutcomeValidationEngine.js";
import { runPsychologyPostFeedback } from "../engines/psychology/PsychologyPipeline.js";
import {
  fireCompulsionLoop,
  recordCompulsionLoopStage,
} from "../engines/intelligence/CompulsionLoopEngine.js";
import { logger } from "../lib/logger.js";
import { processFeedbackRegeneration } from "../engines/sequence/sequenceRegenerationEngine.js";

// FeedbackWorker — bridge from feedback to signal recalculation.
// If the feedback requires interrogation, the chain is paused until the
// interrogation_answered event resumes it. Otherwise it emits
// signal_recalculation_requested.
//
// Spec: Prompt 6 §STEP 3 (FeedbackWorker), DOC_04 §5.

export const FEEDBACK_QUEUE = WorkerQueues.FEEDBACK_PROCESSING;

workerRegistry.register({
  name: "FeedbackWorker",
  queue: FEEDBACK_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "FeedbackWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        const feedbackId = (payload as Record<string, unknown> | undefined)?.["feedback_id"] as
          | string
          | undefined;

        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const workflowName = Workflows.FEEDBACK_COMPLETION.name;
        const locked = await acquireBlueprintWorkflowLock(blueprintId, workflowName, {
          causationEventId: data.eventId,
          userId,
        });
        if (!locked) {
          logger.warn(
            { blueprintId, workflowName },
            "[FeedbackWorker] Blueprint lock timeout — workflow deferred to DLQ",
          );
          return { success: false, retryable: true, reason: "orchestration_lock_timeout" };
        }

        try {
        const eventType = data.eventType;

        if (
          eventType === EVENT_TYPES.FEEDBACK_REJECTED ||
          eventType === EVENT_TYPES.FEEDBACK_HELD_FOR_REVIEW ||
          eventType === EVENT_TYPES.FEEDBACK_NEEDS_CLARIFICATION
        ) {
          logger.info(
            { eventType, feedbackId, blueprintId },
            "[FeedbackWorker] No signal chain for verdict",
          );
          return { success: true };
        }

        const requiresInterrogation = Boolean(
          (payload as Record<string, unknown> | undefined)?.["requires_interrogation"],
        );

        if (requiresInterrogation) {
          logger.info(
            { feedbackId, blueprintId },
            "[FeedbackWorker] Interrogation required — chain paused",
          );
          // Chain resumes via a separate interrogation_answered event.
          return { success: true };
        }

        const payloadRec = payload as Record<string, unknown> | undefined;
        const completionStatus = payloadRec?.["completion_status"] as string | undefined;
        const orderId = payloadRec?.["order_id"] as string | undefined;

        if (feedbackId && orderId) {
          await runPsychologyPostFeedback({
            userId,
            blueprintId,
            orderId,
            feedbackId,
            completionStatus,
          }).catch(() => null);

          const score = Number(payloadRec?.["score"] ?? 7);
          const [bpTier] = await db
            .select({ tier: blueprints.tier })
            .from(blueprints)
            .where(eq(blueprints.id, blueprintId))
            .limit(1)
            .catch(() => []);
          await processFeedbackRegeneration({
            blueprintId,
            userId,
            tier: bpTier?.tier,
            completion: completionStatus,
            score,
            reflection: payloadRec?.["reflection"] as string | undefined,
          }).catch(() => null);

          const { handleAcademyFeedback } = await import(
            "../engines/academy/AcademyFeedbackHandler.js"
          );
          await handleAcademyFeedback({
            userId,
            blueprintId,
            orderId,
            feedbackId,
            completionScore: score,
          }).catch(() => null);
        }

        if (feedbackId && completionStatus === "completed") {
          const [fb] = await db
            .select({ reflection: feedback.reflection, order_id: feedback.order_id })
            .from(feedback)
            .where(eq(feedback.id, feedbackId))
            .limit(1);

          const [order] = fb?.order_id
            ? await db
                .select({ linked_target_id: orders.linked_target_id })
                .from(orders)
                .where(eq(orders.id, fb.order_id))
                .limit(1)
            : [undefined];

          await validateOutcome({
            userId,
            blueprintId,
            targetId: order?.linked_target_id ?? undefined,
            claimText: fb?.reflection?.slice(0, 500) ?? undefined,
            evidenceText: fb?.reflection ?? undefined,
            sourceType: "feedback",
            sourceId: feedbackId,
          });

          await recordCompulsionLoopStage({
            blueprintId,
            userId,
            stage: "REALITY_EXECUTION_RECORDED",
            entityType: "feedback",
            entityId: feedbackId,
            causationEventId: data.eventId,
          });

          if (orderId) {
            const { markOrderDependenciesSatisfied } = await import(
              "../engines/execution-loop/DependencyEngine.js"
            );
            await markOrderDependenciesSatisfied(orderId);
          }
        }

        if (feedbackId && orderId && completionStatus === "failed") {
          const [ord] = await db
            .select({ task_type: orders.task_type })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);
          if (ord?.task_type) {
            const { handleRepeatedFailureAcademy } = await import(
              "../engines/academy/AcademyEngine.js"
            );
            await handleRepeatedFailureAcademy({
              userId,
              blueprintId,
              orderId,
              taskType: ord.task_type,
            }).catch(() => null);
          }
        }

        if (
          feedbackId &&
          orderId &&
          (completionStatus === "failed" || completionStatus === "skipped") &&
          data.eventType !== EVENT_TYPES.FAILURE_CLASSIFICATION_REQUESTED
        ) {
          await writeEvent({
            eventType: EVENT_TYPES.FAILURE_CLASSIFICATION_REQUESTED,
            entityType: "feedback",
            entityId: feedbackId,
            userId,
            blueprintId,
            payload: { order_id: orderId, feedback_id: feedbackId },
            idempotencyKey: `failure_classification:${feedbackId}`,
            causationEventId: data.eventId,
          }).catch(() => null);
        }

        if (feedbackId) {
          const { frictionDetectionEngine } = await import(
            "../engines/friction/FrictionDetectionEngine.js"
          );
          await frictionDetectionEngine.detect({
            userId,
            blueprintId,
            feedbackId,
          });
        }

        await writeEvent({
          eventType: EVENT_TYPES.PATTERN_SCAN_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { trigger_feedback_id: feedbackId, window_days: 14 },
          idempotencyKey: `pattern_scan:${blueprintId}:feedback:${feedbackId ?? Date.now()}`,
          causationEventId: data.eventId,
        });

        const { refreshDashboardIntelligence } = await import(
          "../engines/dashboard/DashboardIntelligenceEngine.js"
        );
        await refreshDashboardIntelligence(userId, "PRIMARY_LOOP_COMPLETE").catch(() => null);

        await writeEvent({
          eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { trigger_feedback_id: feedbackId },
          idempotencyKey: `signal_recalc:${blueprintId}:feedback:${feedbackId ?? Date.now()}`,
          causationEventId: data.eventId,
        });

        await recordOperatingLoopStage({
          blueprintId,
          userId,
          stage: "SIGNAL_RECALCULATION_ENQUEUED",
          description: `Signal recalculation requested after feedback ${feedbackId ?? "unknown"}.`,
          causationEventId: data.eventId,
          triggerEventType: "feedback_processing_requested",
          correlation: { feedback_id: feedbackId },
        }).catch(() => null);

        if (feedbackId) {
          const [fbRow] = await db
            .select()
            .from(feedback)
            .where(eq(feedback.id, feedbackId))
            .limit(1);

          if (fbRow && isVerifiedFeedbackEvidence(fbRow)) {
            await fireCompulsionLoop({
              userId,
              blueprintId,
              feedbackId,
              causationEventId: data.eventId,
            });
          }
        }

        await recordCompulsionLoopStage({
          blueprintId,
          userId,
          stage: "PROOF_FEEDBACK_INGESTED",
          causationEventId: data.eventId,
          correlation: { feedback_id: feedbackId },
        }).catch(() => null);

        logger.info(
          { blueprintId, feedbackId },
          "[FeedbackWorker] Signal recalculation requested",
        );
        return { success: true };
        } finally {
          await releaseBlueprintWorkflowLock(blueprintId, workflowName);
        }
      });
    }
  },
});
