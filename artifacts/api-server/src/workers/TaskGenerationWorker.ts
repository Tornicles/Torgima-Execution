import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { recordOperatingLoopStage } from "../services/OperatingLoopRecorder.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

export const TASK_GENERATION_QUEUE = "task_generation_requested";

workerRegistry.register({
  name: "TaskGenerationWorker",
  queue: TASK_GENERATION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "TaskGenerationWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const p = payload as Record<string, unknown> | undefined;

        const guaranteeResult = await guaranteeTask({
          blueprintId,
          userId,
          generationMode: (p?.["generation_mode"] as string) ?? "post_feedback",
          generationTrigger: (p?.["generation_trigger"] as string) ?? "task_generation_requested",
          enforcementPackageId: p?.["enforcement_package_id"] as string | undefined,
          causationEventId: data.eventId,
        });

        await incrementStateVersion(blueprintId, "task_generation_completed", data.eventId);

        await writeEvent({
          eventType: EVENT_TYPES.TASK_GENERATION_COMPLETED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: {
            guarantee_state: guaranteeResult.state,
            order_id: guaranteeResult.orderId,
          },
          idempotencyKey: `task_gen_complete:${blueprintId}:${data.eventId ?? Date.now()}`,
          causationEventId: data.eventId,
        });

        await writeEvent({
          eventType: EVENT_TYPES.PROJECTION_REFRESH_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { order_id: guaranteeResult.orderId },
          idempotencyKey: `proj_refresh:${blueprintId}:${Date.now()}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, state: guaranteeResult.state, orderId: guaranteeResult.orderId },
          "[TaskGenerationWorker] Complete",
        );

        await recordOperatingLoopStage({
          blueprintId,
          userId,
          stage: "TASK_GENERATION_COMPLETED",
          description: `Task generation finished; guarantee state=${guaranteeResult.state}, order=${guaranteeResult.orderId ?? "none"}.`,
          causationEventId: data.eventId,
          triggerEventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
          correlation: {
            order_id: guaranteeResult.orderId,
            guarantee_state: guaranteeResult.state,
          },
        }).catch(() => null);
        return { success: true };
      });
    }
  },
});
