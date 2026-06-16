/**
 * DOC17 Task 4 — targeted repairs for integrity violations.
 */

import {
  db,
  blueprints,
  orders,
  feedback,
  systemHealthLogs,
  blueprintMutations,
} from "@workspace/db";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { BlueprintStatus, OrderStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { HealthFinding } from "../../services/SystemHealthService.js";
import { appendBlueprintVersionAudit } from "../../lib/state/StateMutationService.js";

async function logRepair(
  action: string,
  blueprintId: string | undefined,
  userId: string | undefined,
  details: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(systemHealthLogs)
    .values({
      area: "STATE_INTEGRITY",
      severity: "INFO",
      blueprint_id: blueprintId,
      user_id: userId,
      check_type: `REPAIR_${action}`,
      message: `Repair executed: ${action}`,
      status: "ok",
      details_json: details,
    })
    .catch(() => null);
}

export async function repairMissingSignal(blueprintId: string, userId: string): Promise<void> {
  await logRepair("MISSING_SIGNAL", blueprintId, userId, { blueprintId });

  const [recent] = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(
      and(
        eq(feedback.blueprint_id, blueprintId),
        eq(feedback.user_id, userId),
        gt(feedback.created_at, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(1);

  if (recent) {
    await writeEvent({
      eventType: EVENT_TYPES.SIGNAL_RECALCULATION_REQUESTED,
      entityType: "blueprint",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: { trigger: "repair_missing_signal", feedback_id: recent.id },
      idempotencyKey: `repair_signal:${blueprintId}:${recent.id}`,
    });
    return;
  }

  await writeEvent({
    eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { trigger: "repair_no_feedback_assign_nothingness" },
    idempotencyKey: `repair_condition:${blueprintId}:nothingness`,
  });
}

export async function repairMissingCondition(blueprintId: string, userId: string): Promise<void> {
  await logRepair("MISSING_CONDITION", blueprintId, userId, { blueprintId });
  await writeEvent({
    eventType: EVENT_TYPES.CONDITION_EVALUATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { trigger: "repair_missing_condition" },
    idempotencyKey: `repair_condition:${blueprintId}`,
  });
}

export async function repairMissingEnforcement(blueprintId: string, userId: string): Promise<void> {
  await logRepair("MISSING_ENFORCEMENT", blueprintId, userId, { blueprintId });
  await writeEvent({
    eventType: EVENT_TYPES.CONDITION_EVALUATED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { trigger: "repair_missing_enforcement", recovery: true },
    idempotencyKey: `repair_enforcement:${blueprintId}`,
  });
}

export async function repairDoubleActiveOrder(userId: string, blueprintId: string): Promise<void> {
  const activeOrders = await db
    .select({ id: orders.id, created_at: orders.created_at })
    .from(orders)
    .where(
      and(
        eq(orders.user_id, userId),
        eq(orders.blueprint_id, blueprintId),
        eq(orders.status, OrderStatus.ACTIVE),
      ),
    )
    .orderBy(desc(orders.created_at));

  if (activeOrders.length <= 1) return;

  const [keep, ...pauseThese] = activeOrders;
  await logRepair("DOUBLE_ACTIVE_ORDER", blueprintId, userId, {
    kept_order_id: keep?.id,
    paused_count: pauseThese.length,
  });

  await db.transaction(async (tx) => {
    for (const row of pauseThese) {
      await tx
        .update(orders)
        .set({ status: OrderStatus.PAUSED })
        .where(eq(orders.id, row.id));
    }

    const [bp] = await tx
      .select({ state_version: blueprints.state_version })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);

    const previousVersion = bp?.state_version ?? 0;
    const newVersion = previousVersion + 1;

    await tx
      .update(blueprints)
      .set({ state_version: newVersion })
      .where(eq(blueprints.id, blueprintId));

    await appendBlueprintVersionAudit(tx, {
      blueprintId,
      userId,
      previousVersion,
      newVersion,
      mutationName: "repair_double_active_order",
      afterState: { paused_order_ids: pauseThese.map((o) => o.id) },
    });

    await tx.insert(blueprintMutations).values({
      blueprint_id: blueprintId,
      mutation_type: "repair_double_active_order",
      layer: "execution",
      entity_id: keep?.id ?? null,
      change_summary: `Paused ${pauseThese.length} duplicate active order(s) key:repair:${blueprintId}`,
      cascade_json: { paused: pauseThese.map((o) => o.id) },
      approved: true,
      approved_at: new Date(),
    });
  });

  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: { generation_mode: "recovery", generation_trigger: "double_active_order_repair" },
    idempotencyKey: `repair_task_gen:${blueprintId}:${Date.now()}`,
  });
}

export async function repairOrphanTask(orderId: string, blueprintId: string, userId: string): Promise<void> {
  await logRepair("ORPHAN_TASK", blueprintId, userId, { orderId });
  await writeEvent({
    eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
    entityType: "order",
    entityId: orderId,
    userId,
    blueprintId,
    payload: { generation_mode: "recovery", generation_trigger: "orphan_task_repair" },
    idempotencyKey: `repair_orphan:${orderId}`,
  });
}

export async function attemptRepairForFinding(finding: HealthFinding): Promise<void> {
  if (!finding.repairable) return;

  switch (finding.issueCode) {
    case "MISSING_CURRENT_SIGNAL":
    case "FEEDBACK_WITHOUT_SIGNAL_EVENT":
      if (finding.blueprintId && finding.userId) {
        await repairMissingSignal(finding.blueprintId, finding.userId);
      }
      break;
    case "MISSING_CURRENT_CONDITION":
      if (finding.blueprintId && finding.userId) {
        await repairMissingCondition(finding.blueprintId, finding.userId);
      }
      break;
    case "MISSING_CURRENT_ENFORCEMENT":
    case "ACTIVE_BLUEPRINT_NO_ENFORCEMENT":
      if (finding.blueprintId && finding.userId) {
        await repairMissingEnforcement(finding.blueprintId, finding.userId);
      }
      break;
    case "DOUBLE_ACTIVE_ORDER":
      if (finding.blueprintId && finding.userId) {
        await repairDoubleActiveOrder(finding.userId, finding.blueprintId);
      }
      break;
    case "ORPHAN_TASK":
      if (finding.blueprintId && finding.userId && finding.entityId) {
        await repairOrphanTask(finding.entityId, finding.blueprintId, finding.userId);
      }
      break;
    case "STALE_STATE_VERSION":
      if (finding.blueprintId && finding.userId) {
        await repairMissingSignal(finding.blueprintId, finding.userId);
      }
      break;
    default:
      break;
  }
}
