import { db, pool } from "@workspace/db";
import { events, eventLogs } from "@workspace/db";
import { eq, and, lte, inArray } from "drizzle-orm";
import { getBoss } from "../lib/queue.js";
import { logger } from "../lib/logger.js";
import { EventStatus } from "@workspace/state-machine";

// Queue names mapped from event types
const EVENT_QUEUE_MAP: Record<string, string> = {
  "feedback_submitted":             "feedback_processing_requested",
  "interrogation_answered":         "signal_recalculation_requested",
  "signal_recalculation_requested": "signal_recalculation_requested",
  "signal_calculated":              "condition_evaluation_requested",
  "condition_evaluated":            "enforcement_package_requested",
  "enforcement_package_created":    "task_generation_requested",
  "task_generation_requested":      "task_generation_requested",
  "task_generation_completed":    "task_guarantee_check",
  "queue_empty_detected":           "task_generation_requested",
  "dashboard_refresh_requested":  "projection_refresh_requested",
  "inactivity_scan_requested":      "inactivity_scan_requested",
  "inactivity_detected":            "task_generation_requested",
  "reminder_requested":             "reminder_requested",
  "notification_send_requested":    "notification_send_requested",
  "state_changed":                  "projection_refresh_requested",
  "projection_refresh_requested":   "projection_refresh_requested",
  "bhudhi_trigger_requested":       "bhudhi_trigger_requested",
  "system_health_degraded":         "system_health_event",
  "blueprint_launched":             "task_generation_requested",
  "pivot_review_requested":         "task_generation_requested",
  "reward_evaluation_requested":   "reward_evaluation_requested",
  "identity_evaluation_requested": "identity_evaluation_requested",
  "validation_start_requested":      "validation_start_requested",
  "pattern_scan_requested":          "pattern_scan_requested",
  "assumption_check_requested":      "assumption_check_requested",
  "system_health_scan_requested":    "system_health_event",
  "dead_letter_review_requested":    "dead_letter_review_requested",
};

// Events that record state transitions but never need to be re-dispatched.
// They are persisted for audit/projection but have no consumer queue.
const TERMINAL_EVENT_TYPES = new Set<string>([
  "order_available",
  "system_health_restored",
  // Intelligence / adaptation — audit-only, no queue consumer
  "burnout_risk_detected",
  "cognitive_load_high",
  "friction_adaptation_requested",
  "external_signal_received",
  "ORCHESTRATION_LOCK",
  "false_progress_detected",
  "failure_classified",
  "operating_loop_stage",
  "overnight_complete",
  "health_alert",
  "dlq_item_created",
]);

const DISPATCH_BATCH_SIZE = 50;

export async function dispatchPendingEvents(): Promise<number> {
  // Claim a batch of PENDING events atomically
  const pendingEvents = await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(events)
      .where(and(eq(events.status, EventStatus.PENDING), lte(events.process_after, new Date())))
      .orderBy(events.created_at)
      .limit(DISPATCH_BATCH_SIZE);

    if (pending.length === 0) return [];

    const ids = pending.map((e) => e.id);
    await tx.update(events).set({ status: "claimed" }).where(inArray(events.id, ids));

    return pending;
  });

  if (pendingEvents.length === 0) return 0;

  const boss = await getBoss();
  let dispatched = 0;

  for (const event of pendingEvents) {
    const queueName = EVENT_QUEUE_MAP[event.event_type];

    if (!queueName) {
      if (TERMINAL_EVENT_TYPES.has(event.event_type)) {
        // Audit-only event — mark processed quietly.
        await markEventProcessed(event.id, "success");
      } else {
        logger.warn(
          { eventType: event.event_type, eventId: event.id },
          "[EventDispatcher] No queue mapping for event type",
        );
        await markEventProcessed(event.id, "noop_duplicate");
      }
      continue;
    }

    try {
      // Idempotency check — skip if already successfully processed
      if (event.idempotency_key) {
        const [existing] = await db
          .select({ id: eventLogs.id })
          .from(eventLogs)
          .where(and(eq(eventLogs.event_id, event.id), eq(eventLogs.result, "success")))
          .limit(1);
        if (existing) {
          await markEventProcessed(event.id, "noop_duplicate");
          continue;
        }
      }

      await boss.send(queueName, {
        eventId: event.id,
        eventType: event.event_type,
        entityType: event.entity_type,
        entityId: event.entity_id,
        userId: event.user_id,
        blueprintId: event.blueprint_id,
        payload: event.payload,
      });

      dispatched++;
      logger.debug(
        { eventId: event.id, queue: queueName },
        "[EventDispatcher] Event dispatched to queue",
      );
    } catch (err) {
      logger.error(
        { eventId: event.id, error: err instanceof Error ? err.message : String(err) },
        "[EventDispatcher] Failed to dispatch event",
      );
      // Return to pending for retry
      await db
        .update(events)
        .set({ status: EventStatus.PENDING, retry_count: event.retry_count + 1 })
        .where(eq(events.id, event.id))
        .catch(() => null);
    }
  }

  return dispatched;
}

export async function getEventSystemHealth(): Promise<{
  pending_events: number;
  unresolved_dead_letters: number;
}> {
  const pendingResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM events WHERE status = 'pending'",
  );
  const dlResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*) as count FROM dead_letter_events WHERE resolved = false",
  );
  return {
    pending_events: parseInt(pendingResult.rows[0]?.count ?? "0", 10),
    unresolved_dead_letters: parseInt(dlResult.rows[0]?.count ?? "0", 10),
  };
}

async function markEventProcessed(eventId: string, result: "success" | "noop_duplicate"): Promise<void> {
  await db.update(events).set({ status: "processed" }).where(eq(events.id, eventId)).catch(() => null);
  await db
    .insert(eventLogs)
    .values({ event_id: eventId, result, processed_at: new Date() })
    .catch(() => null);
}
