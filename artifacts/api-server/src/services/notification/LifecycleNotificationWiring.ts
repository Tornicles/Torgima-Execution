import { writeEvent, EVENT_TYPES } from "../EventService.js";
import { NOTIFICATION_TYPES } from "../../constants/notifications.js";

export async function notifyBlueprintCompleted(params: {
  userId: string;
  blueprintId: string;
  tasksCompleted: number;
  executionDays: number;
}): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.NOTIFICATION_SEND_REQUESTED,
    entityType: "notification",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      notification_type: NOTIFICATION_TYPES.BLUEPRINT_COMPLETED,
      context_data: {
        tasksCompleted: params.tasksCompleted,
        executionDays: params.executionDays,
      },
    },
    idempotencyKey: `notify:completed:${params.blueprintId}`,
  }).catch(() => null);
}

export async function notifyBlueprintPaused(params: { userId: string; blueprintId: string }): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.NOTIFICATION_SEND_REQUESTED,
    entityType: "notification",
    entityId: params.blueprintId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: { notification_type: NOTIFICATION_TYPES.BLUEPRINT_PAUSED_CONFIRMATION },
    idempotencyKey: `notify:paused:${params.blueprintId}:${Date.now()}`,
  }).catch(() => null);
}

export async function notifyMilestoneAchieved(params: {
  userId: string;
  blueprintId: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneDesc?: string;
}): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.NOTIFICATION_SEND_REQUESTED,
    entityType: "notification",
    entityId: params.milestoneId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: {
      notification_type: NOTIFICATION_TYPES.MILESTONE_ACHIEVED,
      context_data: {
        milestoneTitle: params.milestoneTitle,
        milestoneDesc: params.milestoneDesc,
      },
    },
    idempotencyKey: `notify:milestone:${params.milestoneId}`,
  }).catch(() => null);
}

export async function notifyPivotReviewReady(params: {
  userId: string;
  blueprintId: string;
  reviewId: string;
}): Promise<void> {
  await writeEvent({
    eventType: EVENT_TYPES.NOTIFICATION_SEND_REQUESTED,
    entityType: "notification",
    entityId: params.reviewId,
    userId: params.userId,
    blueprintId: params.blueprintId,
    payload: { notification_type: NOTIFICATION_TYPES.PIVOT_REVIEW_READY },
    idempotencyKey: `notify:pivot:${params.reviewId}`,
  }).catch(() => null);
}
