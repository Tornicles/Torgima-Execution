/**
 * DOC 36 — poll events table for pipeline milestones.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db, events } from "@workspace/db";
import { EventTypes } from "../../types/eventContracts.js";

const EVENT_ALIASES: Record<string, string> = {
  order_available: EventTypes.ORDER_AVAILABLE,
  signal_calculated: EventTypes.SIGNAL_CALCULATED,
  condition_evaluated: EventTypes.CONDITION_EVALUATED,
  enforcement_package_created: EventTypes.ENFORCEMENT_PACKAGE_CREATED,
  task_generation_completed: EventTypes.TASK_GENERATION_COMPLETED,
};

export type Doc36EventRow = {
  id: string;
  blueprint_id: string | null;
  event_type: string;
  order_id?: string | null;
  payload?: unknown;
};

export async function waitForEvent(
  alias: keyof typeof EVENT_ALIASES | string,
  blueprintId: string,
  timeoutMs: number,
  since = new Date(Date.now() - 60_000),
): Promise<Doc36EventRow> {
  const eventType = EVENT_ALIASES[alias] ?? alias;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [row] = await db
      .select({
        id: events.id,
        blueprint_id: events.blueprint_id,
        event_type: events.event_type,
        payload: events.payload,
      })
      .from(events)
      .where(
        and(
          eq(events.blueprint_id, blueprintId),
          eq(events.event_type, eventType),
          gte(events.created_at, since),
        ),
      )
      .orderBy(desc(events.created_at))
      .limit(1);

    if (row) {
      const payload = row.payload as { order_id?: string; orderId?: string } | null;
      return {
        ...row,
        order_id: payload?.order_id ?? payload?.orderId ?? null,
      };
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  throw new Error(`DOC36: timed out waiting for event ${eventType} (${timeoutMs}ms)`);
}
