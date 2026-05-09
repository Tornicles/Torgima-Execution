import { workerRegistry } from "./WorkerRegistry.js";
import { handleWorkerJob } from "./BaseWorkerHandler.js";
import {
  db,
  signalSnapshots,
  conditions as conditionsTable,
  blueprints,
  stateMemory,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { incrementStateVersion } from "../services/StateMutationService.js";
import { logger } from "../lib/logger.js";

// ConditionWorker — bridges signal_calculated to a new conditions row +
// state_memory transition, then emits condition_evaluated which routes via the
// dispatcher to the enforcement_package_requested queue.
//
// Real ConditionEvaluationEngine lands in Prompt 7; the worker echoes the
// signal's assigned_condition so downstream workers always have a current row.
//
// Spec: Prompt 6 §STEP 3 (ConditionWorker), DOC_04 §7.

export const CONDITION_QUEUE = "condition_evaluation_requested";

workerRegistry.register({
  name: "ConditionWorker",
  queue: CONDITION_QUEUE,
  options: { localConcurrency: 5, pollingIntervalSeconds: 2 },
  handler: async (jobs) => {
    for (const job of jobs) {
      await handleWorkerJob(job, "ConditionWorker", async (data) => {
        const { blueprintId, userId } = data;
        if (!blueprintId || !userId) {
          return { success: false, retryable: false, reason: "Missing blueprintId" };
        }

        const [signal] = await db
          .select()
          .from(signalSnapshots)
          .where(
            and(
              eq(signalSnapshots.blueprint_id, blueprintId),
              eq(signalSnapshots.is_current, true),
            ),
          )
          .limit(1);

        if (!signal) {
          return { success: false, retryable: true, reason: "No current signal snapshot found" };
        }

        const condition = signal.assigned_condition ?? "urgency";

        // Deactivate previous current condition
        await db
          .update(conditionsTable)
          .set({ is_current: false, exited_at: new Date() })
          .where(
            and(
              eq(conditionsTable.blueprint_id, blueprintId),
              eq(conditionsTable.is_current, true),
            ),
          );

        const [conditionRecord] = await db
          .insert(conditionsTable)
          .values({
            blueprint_id: blueprintId,
            user_id: userId,
            condition,
            signal_snapshot_id: signal.id,
            duration_days: 1,
            escalation_level: 0,
            recovery_required: condition === "danger",
            is_current: true,
            entered_at: new Date(),
          })
          .returning({ id: conditionsTable.id });

        if (!conditionRecord) {
          return { success: false, retryable: true, reason: "Failed to create condition record" };
        }

        await db
          .update(blueprints)
          .set({ current_condition: condition })
          .where(eq(blueprints.id, blueprintId));

        // Roll state_memory: close previous, open new
        await db
          .update(stateMemory)
          .set({ is_current: false, exited_at: new Date() })
          .where(
            and(
              eq(stateMemory.blueprint_id, blueprintId),
              eq(stateMemory.is_current, true),
            ),
          );

        await db.insert(stateMemory).values({
          blueprint_id: blueprintId,
          user_id: userId,
          condition,
          entered_at: new Date(),
          is_current: true,
          duration_days: 0,
          escalation_level: 0,
        });

        await incrementStateVersion(blueprintId, "condition_evaluated", data.eventId);

        // Continue chain — condition_evaluated → enforcement_package_requested queue
        await writeEvent({
          eventType: EVENT_TYPES.CONDITION_EVALUATED,
          entityType: "condition",
          entityId: conditionRecord.id,
          userId,
          blueprintId,
          payload: { condition_id: conditionRecord.id, condition },
          idempotencyKey: `enforcement_req:${blueprintId}:${conditionRecord.id}`,
          causationEventId: data.eventId,
        });

        logger.info(
          { blueprintId, condition, conditionId: conditionRecord.id },
          "[ConditionWorker] Condition evaluated (stub)",
        );
        return { success: true };
      });
    }
  },
});
