import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob, type WorkerJobData } from "./BaseWorkerHandler.js";
import { sendNotification } from "../services/NotificationService.js";
import { NOTIFICATION_TYPES, type NotificationType } from "../constants/notifications.js";
import { db, orders } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export const NOTIFICATION_QUEUE = "notification_send_requested";

export const REMINDER_QUEUE = "reminder_requested";

workerRegistry.register({
  name: "NotificationWorker",
  queue: NOTIFICATION_QUEUE,
  options: { localConcurrency: 3, pollingIntervalSeconds: 10 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "NotificationWorker", async (data: WorkerJobData) => {
        const { userId, blueprintId, payload } = data;
        if (!userId) return { success: false, retryable: false, reason: "Missing userId" };

        const notificationType = payload["notification_type"] as NotificationType | undefined;
        if (!notificationType) return { success: false, retryable: false, reason: "Missing notification_type" };

        try {
          await sendNotification({
            userId,
            blueprintId: blueprintId ?? undefined,
            notificationType,
            sourceEventId: data.eventId,
            contextData: (payload["context_data"] as Record<string, unknown>) ?? {},
            escalation: Boolean(payload["escalation"]),
          });

          logger.info(
            {
              type: notificationType,
              userId,
            },
            "[NotificationWorker] Processed",
          );

          return { success: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("notification_send_exhausted")) {
            logger.warn({ userId, msg }, "[NotificationWorker] Send exhausted — acknowledging job");
            return { success: true };
          }
          logger.warn({ userId, error: msg }, "[NotificationWorker] Delivery error — retry");
          return { success: false, retryable: true, reason: msg };
        }
      });
    }
  },
});

workerRegistry.register({
  name: "ReminderWorker",
  queue: REMINDER_QUEUE,
  options: { localConcurrency: 2, pollingIntervalSeconds: 10 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ReminderWorker", async (data: WorkerJobData) => {
        const { userId, blueprintId, payload } = data;
        if (!userId) return { success: false, retryable: false, reason: "Missing userId" };

        const severity = (payload["severity"] as string) ?? "soft";
        const isEscalation = severity === "hard" || severity === "critical";

        let taskTitle: string | undefined;
        if (blueprintId) {
          const [activeOrder] = await db
            .select({ title: orders.title })
            .from(orders)
            .where(
              and(
                eq(orders.blueprint_id, blueprintId),
                eq(orders.user_id, userId),
                inArray(orders.status, ["pending", "active"]),
              ),
            )
            .limit(1);
          taskTitle = activeOrder?.title;
        }

        try {
          await sendNotification({
            userId,
            blueprintId: blueprintId ?? undefined,
            notificationType: NOTIFICATION_TYPES.INACTIVITY_REMINDER,
            sourceEventId: data.eventId,
            escalation: isEscalation,
            contextData: {
              taskTitle,
              hoursInactive: payload["hours"] as number | undefined,
              severity,
            },
          });

          return { success: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("notification_send_exhausted")) return { success: true };
          return { success: false, retryable: true, reason: msg };
        }
      });
    }
  },
});
