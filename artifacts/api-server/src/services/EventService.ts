import { db } from "@workspace/db";
import { events } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { EventStatus } from "@workspace/state-machine";

// ── EVENT TYPES ───────────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  // Feedback chain
  FEEDBACK_SUBMITTED:             "feedback_submitted",
  FEEDBACK_REJECTED:              "feedback_rejected",
  INTERROGATION_ANSWERED:         "interrogation_answered",
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
  QUEUE_EMPTY_DETECTED:           "queue_empty_detected",
  DASHBOARD_REFRESH_REQUESTED:    "dashboard_refresh_requested",
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
  /** Audit-only deterministic operating-loop timeline (never dispatches queues). */
  OPERATING_LOOP_STAGE:           "operating_loop_stage",
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
  FAILURE_CLASSIFIED:              "failure_classified",
  PATTERN_SCAN_REQUESTED:          "pattern_scan_requested",
  VALIDATION_START_REQUESTED:      "validation_start_requested",
  VALIDATION_COMPLETED:            "validation_completed",
  VALIDATION_PATH_SELECTED:        "validation_path_selected",
  ASSUMPTION_CHECK_REQUESTED:      "assumption_check_requested",
  EIS_REFRESH_REQUESTED:           "eis_refresh_requested",
  SYSTEM_HEALTH_SCAN_REQUESTED:    "system_health_scan_requested",
  DEAD_LETTER_REVIEW_REQUESTED:    "dead_letter_review_requested",
  // Prompt 8 — system lifecycle
  OVERNIGHT_COMPLETE:              "overnight_complete",
  HEALTH_ALERT:                    "health_alert",
  DLQ_ITEM_CREATED:                "dlq_item_created",
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

  const basePayload = (input.payload ?? {}) as Record<string, unknown>;
  const payloadMerged: Record<string, unknown> = {
    ...basePayload,
    ...(input.causationEventId ? { causation_event_id: input.causationEventId } : {}),
  };

  const row: InferInsertModel<typeof events> = {
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    blueprint_id: input.blueprintId,
    payload: payloadMerged,
    idempotency_key: input.idempotencyKey,
    process_after: input.processAfter ?? new Date(),
    status: EventStatus.PENDING,
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

/** Idempotent event emit — duplicate idempotency_key returns existing event id. */
export async function emitEvent(
  params: CreateEventInput & { idempotencyKey: string },
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const client = tx ?? db;
  const [inserted] = await (client as typeof db)
    .insert(events)
    .values({
      event_type: params.eventType,
      entity_type: params.entityType,
      entity_id: params.entityId,
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      payload: params.payload ?? {},
      idempotency_key: params.idempotencyKey,
      process_after: params.processAfter ?? new Date(),
      status: EventStatus.PENDING,
    })
    .onConflictDoNothing({ target: events.idempotency_key })
    .returning({ id: events.id });

  if (inserted?.id) return inserted.id;

  const [existing] = await client
    .select({ id: events.id })
    .from(events)
    .where(eq(events.idempotency_key, params.idempotencyKey))
    .limit(1);

  if (!existing) throw new Error("Failed to emit event");
  return existing.id;
}

export async function writeEventInTx(
  input: CreateEventInput,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const basePayload = (input.payload ?? {}) as Record<string, unknown>;
  const payloadMerged: Record<string, unknown> = {
    ...basePayload,
    ...(input.causationEventId ? { causation_event_id: input.causationEventId } : {}),
  };

  const [inserted] = await tx
    .insert(events)
    .values({
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      payload: payloadMerged,
      idempotency_key: input.idempotencyKey,
      process_after: input.processAfter ?? new Date(),
      status: EventStatus.PENDING,
    })
    .returning({ id: events.id });

  if (!inserted) throw new Error("Failed to write event to outbox");

  logger.debug(
    { eventId: inserted.id, eventType: input.eventType, blueprintId: input.blueprintId },
    "[EventService] Event written to outbox (tx)",
  );

  return inserted.id;
}
