import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import { db, orders } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { logger } from "../lib/logger.js";

import { WorkerQueues } from "../types/eventContracts.js";

export const TASK_GUARANTEE_QUEUE = WorkerQueues.TASK_GUARANTEE;

workerRegistry.register({
  name: "TaskGuaranteeWorker",
  queue: TASK_GUARANTEE_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "TaskGuaranteeWorker", async (data) => {
        const { blueprintId, userId, payload } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId or userId" };
        }

        const p = payload as Record<string, unknown> | undefined;
        const orderIdFromPayload = p?.["order_id"] as string | undefined;
        const guaranteeState = p?.["guarantee_state"] as string | undefined;

        const [actionable] = await db
          .select({ id: orders.id })
          .from(orders)
          .where(
            and(
              eq(orders.blueprint_id, blueprintId),
              eq(orders.user_id, userId),
              inArray(orders.status, ["pending", "active"]),
            ),
          )
          .limit(1);

        const hasTask = Boolean(actionable?.id ?? orderIdFromPayload);
        const satisfied = guaranteeState === "SATISFIED" || hasTask;

        if (!satisfied) {
          await writeEvent({
            eventType: EVENT_TYPES.QUEUE_EMPTY_DETECTED,
            entityType: "blueprint",
            entityId: blueprintId,
            userId,
            blueprintId,
            payload: { trigger: "task_guarantee_check", prior_state: guaranteeState },
            idempotencyKey: `queue_empty:${blueprintId}:${data.eventId ?? Date.now()}`,
            causationEventId: data.eventId,
          });

          await guaranteeTask({
            blueprintId,
            userId,
            generationMode: "recovery",
            generationTrigger: "queue_empty_detected",
            causationEventId: data.eventId,
          }).catch(() => null);

          logger.warn({ blueprintId }, "[TaskGuaranteeWorker] Queue empty — recovery generation");
          return { success: true };
        }

        let orderId = actionable?.id ?? orderIdFromPayload;
        if (orderId) {
          const { resolvePublishableOrder } = await import(
            "../engines/execution-loop/DependencyEngine.js"
          );
          const resolved = await resolvePublishableOrder({
            blueprintId,
            userId,
            orderId,
          });
          orderId = resolved.orderId;
        }

        await writeEvent({
          eventType: EVENT_TYPES.ORDER_AVAILABLE,
          entityType: "order",
          entityId: orderId ?? blueprintId,
          userId,
          blueprintId,
          payload: { order_id: orderId, guarantee_state: guaranteeState ?? "SATISFIED" },
          idempotencyKey: `order_available:${blueprintId}:${orderId ?? "none"}`,
          causationEventId: data.eventId,
        });

        await writeEvent({
          eventType: EVENT_TYPES.DASHBOARD_REFRESH_REQUESTED,
          entityType: "blueprint",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { order_id: orderId },
          idempotencyKey: `dashboard_refresh:${blueprintId}:${Date.now()}`,
          causationEventId: data.eventId,
        });

        logger.info({ blueprintId, orderId }, "[TaskGuaranteeWorker] Order available — loop satisfied");
        return { success: true };
      });
    }
  },
});
