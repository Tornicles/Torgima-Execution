/**
 * 14-day simulation runs workers synchronously (no pg-boss). Pending rows must not
 * accumulate DLQ / execution-lock health entries from failed dispatch.
 */
import { db, deadLetterEvents, events, systemHealthLogs } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { EventStatus } from "@workspace/state-machine";

const OPEN_HEALTH = ["OPEN", "degraded", "IN_PROGRESS"] as const;

const SIMULATION_HEALTH_CHECKS = [
  "CRITICAL_EVENT_DEAD_LETTERED",
  "CRITICAL_DLQ_BLOCKER",
  "EVENT_BACKLOG_HIGH",
] as const;

export async function settleSimulationEvents(blueprintId: string): Promise<void> {
  await db
    .update(events)
    .set({ status: EventStatus.PROCESSED, processed_at: new Date() })
    .where(
      and(
        eq(events.blueprint_id, blueprintId),
        inArray(events.status, [
          EventStatus.PENDING,
          EventStatus.RETRY_PENDING,
          EventStatus.CLAIMED,
        ]),
      ),
    );

  await db
    .update(deadLetterEvents)
    .set({
      resolved: true,
      resolved_at: new Date(),
      resolution_status: "RESOLVED",
      reviewed: true,
      reviewed_at: new Date(),
    })
    .where(
      and(eq(deadLetterEvents.blueprint_id, blueprintId), eq(deadLetterEvents.resolved, false)),
    );

  await db
    .update(systemHealthLogs)
    .set({ status: "RESOLVED" })
    .where(
      and(
        eq(systemHealthLogs.blueprint_id, blueprintId),
        inArray(systemHealthLogs.status, [...OPEN_HEALTH]),
        inArray(systemHealthLogs.check_type, [...SIMULATION_HEALTH_CHECKS]),
      ),
    );
}
