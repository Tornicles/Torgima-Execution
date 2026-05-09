import { db } from "@workspace/db";
import { events } from "@workspace/db";
import type { InferInsertModel } from "drizzle-orm";
import { logger } from "../lib/logger.js";

// ── EVENT TYPES ───────────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  // Feedback chain
  FEEDBACK_SUBMITTED:             "feedback_submitted",
  FEEDBACK_REJECTED:              "feedback_rejected",
  // Signal chain
  SIGNAL_RECALCULATION_REQUESTED: "signal_recalculation_requested",
  SIGNAL_CALCULATED:              "signal_calculated",
  // Condition chain
  CONDITION_EVALUATED:            "condition_evaluated",
  // Control chain
  ENFORCEMENT_PACKAGE_CREATED:    "enforcement_package_created",
  // Task chain
  TASK_GENERATION_REQUESTED:      "task_generation_requested",
  TASK_GENERATION_COMPLETED:      "task_generation_completed",
  TASK_GENERATION_FAILED:         "task_generation_failed",
  ORDER_AVAILABLE:                "order_available",
  // Inactivity
  INACTIVITY_SCAN_REQUESTED:      "inactivity_scan_requested",
  INACTIVITY_DETECTED:            "inactivity_detected",
  INACTIVITY_RESOLVED:            "inactivity_resolved",
  // Blueprint lifecycle
  BLUEPRINT_LAUNCHED:             "blueprint_launched",
  BLUEPRINT_PAUSED:               "blueprint_paused",
  BLUEPRINT_RESUMED:              "blueprint_resumed",
  BLUEPRINT_COMPLETED:            "blueprint_completed",
  BLUEPRINT_ADJUSTED:             "blueprint_adjusted",
  BLUEPRINT_PIVOTED:              "blueprint_pivoted",
  // Pivot review
  PIVOT_REVIEW_REQUESTED:         "pivot_review_requested",
  PIVOT_REVIEW_READY:             "pivot_review_ready",
  PIVOT_REVIEW_DISMISSED:         "pivot_review_dismissed",
  PIVOT_PATH_SELECTED:            "pivot_path_selected",
  // Notifications
  REMINDER_REQUESTED:             "reminder_requested",
  NOTIFICATION_SEND_REQUESTED:    "notification_send_requested",
  // State
  STATE_CHANGED:                  "state_changed",
  PROJECTION_REFRESH_REQUESTED:   "projection_refresh_requested",
  // AI
  BHUDHI_TRIGGER_REQUESTED:       "bhudhi_trigger_requested",
  BHUDHI_CALL_COMPLETED:          "bhudhi_call_completed",
  BHUDHI_FALLBACK_USED:           "bhudhi_fallback_used",
  // Health
  SYSTEM_HEALTH_DEGRADED:         "system_health_degraded",
  SYSTEM_HEALTH_RESTORED:         "system_health_restored",
  // Intelligence / adaptation (Prompt 10)
  BURNOUT_RISK_DETECTED:           "burnout_risk_detected",
  COGNITIVE_LOAD_HIGH:             "cognitive_load_high",
  FRICTION_ADAPTATION_REQUESTED:   "friction_adaptation_requested",
  EXTERNAL_SIGNAL_RECEIVED:        "external_signal_received",
  // Engagement / outcome (Prompt 11)
  FALSE_PROGRESS_DETECTED:         "false_progress_detected",
  IDENTITY_EVALUATION_REQUESTED:   "identity_evaluation_requested",
  REWARD_EVALUATION_REQUESTED:     "reward_evaluation_requested",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface CreateEventInput {
  eventType: EventType;
  entityType: string;
  entityId?: string;
  userId?: string;
  blueprintId?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
  causationEventId?: string;
  processAfter?: Date;
}

// Write an event to the outbox. Call inside a transaction alongside state mutation.
export async function writeEvent(
  input: CreateEventInput,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const client = tx ?? db;

  const row: InferInsertModel<typeof events> = {
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    blueprint_id: input.blueprintId,
    payload: (input.payload ?? {}) as Record<string, unknown>,
    idempotency_key: input.idempotencyKey,
    process_after: input.processAfter ?? new Date(),
    status: "pending",
  };

  const [inserted] = await (client as typeof db)
    .insert(events)
    .values(row)
    .returning({ id: events.id });

  if (!inserted) throw new Error("Failed to write event to outbox");

  logger.debug(
    { eventId: inserted.id, eventType: input.eventType, blueprintId: input.blueprintId },
    "[EventService] Event written to outbox",
  );

  return inserted.id;
}

export async function writeEventInTx(
  input: CreateEventInput,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const [inserted] = await tx
    .insert(events)
    .values({
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      payload: (input.payload ?? {}) as Record<string, unknown>,
      idempotency_key: input.idempotencyKey,
      process_after: input.processAfter ?? new Date(),
      status: "pending",
    })
    .returning({ id: events.id });

  if (!inserted) throw new Error("Failed to write event to outbox");

  logger.debug(
    { eventId: inserted.id, eventType: input.eventType, blueprintId: input.blueprintId },
    "[EventService] Event written to outbox (tx)",
  );

  return inserted.id;
}
