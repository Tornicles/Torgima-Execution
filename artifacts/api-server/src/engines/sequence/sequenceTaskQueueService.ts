/**
 * Prompt 8B — Task generation sequence: visible orders + hidden queue snapshot.
 */
import { db, orders, taskGenerationSequences } from "@workspace/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { SequenceTrackingService } from "../../services/SequenceTrackingService.js";
import type { BlueprintTierKey } from "../../types/blueprintSequences.js";

const VISIBLE_STATUSES = ["active", "pending", "needs_feedback", "in_progress"] as const;
const HIDDEN_STATUSES = ["pre_generated", "queued"] as const;

function tierKey(tier?: string | null): BlueprintTierKey {
  if (tier === "growth" || tier === "ultimate") return tier;
  return "starter";
}

function hiddenHorizonDays(tier: BlueprintTierKey): number {
  if (tier === "starter") return 14;
  if (tier === "growth") return 30;
  return 45;
}

export async function syncTaskGenerationSequence(
  blueprintId: string,
  tier?: string | null,
): Promise<{ synced: boolean; currentOrderCount: number; hiddenQueueLength: number }> {
  const t = tierKey(tier);

  const allRows = await db
    .select({
      id: orders.id,
      instruction: orders.instruction,
      title: orders.title,
      status: orders.status,
      plan_id: orders.plan_id,
      due_at: orders.due_at,
      created_at: orders.created_at,
      is_visible: orders.is_visible,
    })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId))
    .orderBy(asc(orders.created_at));

  const visibleRows = allRows.filter(
    (o) =>
      o.is_visible &&
      (VISIBLE_STATUSES as readonly string[]).includes(o.status),
  );
  const hiddenRows = allRows.filter(
    (o) =>
      !o.is_visible ||
      (HIDDEN_STATUSES as readonly string[]).includes(o.status),
  );

  const currentOrders = visibleRows.map((o) => ({
    id: o.id,
    instruction: o.instruction,
    title: o.title,
    status: o.status,
    planId: o.plan_id,
    visible: true,
  }));

  const hiddenOrders = hiddenRows.map((o) => ({
    id: o.id,
    instruction: o.instruction,
    title: o.title,
    status: o.status,
    dueAt: o.due_at,
    visible: false,
  }));

  const horizon = hiddenHorizonDays(t);

  await db
    .insert(taskGenerationSequences)
    .values({
      blueprint_id: blueprintId,
      current_orders: currentOrders,
      current_order_count: currentOrders.length,
      hidden_orders: hiddenOrders,
      hidden_queue_length: horizon,
      context_injection: ["goal", "purpose", "path", "economy", "condition"],
      future_orders: { count: hiddenOrders.length, horizonDays: horizon },
    })
    .onConflictDoUpdate({
      target: taskGenerationSequences.blueprint_id,
      set: {
        current_orders: currentOrders,
        current_order_count: currentOrders.length,
        hidden_orders: hiddenOrders,
        hidden_queue_length: horizon,
        future_orders: { count: hiddenOrders.length, horizonDays: horizon },
      },
    });

  await SequenceTrackingService.ensureInitialized(blueprintId, t);

  return {
    synced: true,
    currentOrderCount: currentOrders.length,
    hiddenQueueLength: horizon,
  };
}
