import { Router } from "express";
import {
  db,
  blueprints,
  orders,
  feedback,
  signalSnapshots,
  events,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";
import { BlueprintStatus, EventStatus, OrderStatus } from "@workspace/state-machine";

const router = Router();

/**
 * GET /api/v1/debug/loop-state
 * Diagnostic snapshot for the execution loop (auth required).
 */
router.get("/v1/debug/loop-state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [blueprint] = await db
      .select({
        id: blueprints.id,
        status: blueprints.status,
        active: blueprints.active,
        current_condition: blueprints.current_condition,
        goal: blueprints.goal,
        created_at: blueprints.created_at,
      })
      .from(blueprints)
      .where(
        and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)),
      )
      .orderBy(desc(blueprints.created_at))
      .limit(1);

    const blueprintId = blueprint?.id ?? "";

    const orderRows = blueprintId
      ? await db
          .select({
            id: orders.id,
            status: orders.status,
            title: orders.title,
            generation_reason: orders.generation_reason,
            task_type: orders.task_type,
            created_at: orders.created_at,
          })
          .from(orders)
          .where(eq(orders.blueprint_id, blueprintId))
          .orderBy(desc(orders.created_at))
          .limit(10)
      : [];

    const feedbackRows = await db
      .select({
        id: feedback.id,
        order_id: feedback.order_id,
        completion_status: feedback.completion_status,
        created_at: feedback.created_at,
      })
      .from(feedback)
      .where(eq(feedback.user_id, auth.userId))
      .orderBy(desc(feedback.created_at))
      .limit(10);

    const signalRows = blueprintId
      ? await db
          .select({
            id: signalSnapshots.id,
            assigned_condition: signalSnapshots.assigned_condition,
            created_at: signalSnapshots.created_at,
          })
          .from(signalSnapshots)
          .where(eq(signalSnapshots.blueprint_id, blueprintId))
          .orderBy(desc(signalSnapshots.created_at))
          .limit(5)
      : [];

    const pendingEvents = await db
      .select({
        id: events.id,
        event_type: events.event_type,
        status: events.status,
        created_at: events.created_at,
      })
      .from(events)
      .where(
        and(
          eq(events.user_id, auth.userId),
          inArray(events.status, [EventStatus.PENDING, EventStatus.RETRY_PENDING]),
        ),
      )
      .orderBy(desc(events.created_at))
      .limit(20);

    const payload = {
      blueprint: blueprint
        ? {
            id: blueprint.id,
            status: blueprint.status,
            active: blueprint.active,
            condition: blueprint.current_condition,
            goal: blueprint.goal?.slice(0, 120),
            created_at: blueprint.created_at,
          }
        : null,
      orders_count: orderRows.length,
      orders: orderRows.map((o) => ({
        id: o.id,
        status: o.status,
        title: o.title,
        generation_reason: o.generation_reason,
        task_type: o.task_type,
      })),
      pending_actionable_orders: orderRows.filter((o) =>
        o.status === OrderStatus.PENDING || o.status === OrderStatus.ACTIVE,
      ).length,
      feedbacks_count: feedbackRows.length,
      feedbacks: feedbackRows,
      signals_count: signalRows.length,
      signals: signalRows,
      pending_events_count: pendingEvents.length,
      pending_events: pendingEvents,
      blueprint_status_active: blueprint?.status === BlueprintStatus.ACTIVE,
    };

    logger.info({ userId: auth.userId, loopState: payload }, "[Debug] loop-state snapshot");

    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
