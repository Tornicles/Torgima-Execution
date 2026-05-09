import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { events, eventLogs, deadLetterEvents } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { dispatchPendingEvents, getEventSystemHealth } from "../services/EventDispatcher.js";
import { success, failure, handleError } from "../lib/utils.js";
import { pool } from "@workspace/db";

const router = Router();

// POST /api/internal/events/dispatch
router.post("/internal/events/dispatch", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const dispatched = await dispatchPendingEvents();
    success(res, { dispatched });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/events/:id/replay
router.post("/internal/events/:id/replay", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;

    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      failure(res, "NOT_FOUND", "Event not found", 404);
      return;
    }

    if (event.status !== "dead_lettered" && event.status !== "retry_pending") {
      failure(res, "VALIDATION_ERROR", "Only dead_lettered or retry_pending events can be replayed", 422);
      return;
    }

    // Reset to pending for reprocessing
    await db
      .update(events)
      .set({ status: "pending", retry_count: 0 })
      .where(eq(events.id, id));

    await db.insert(eventLogs).values({
      event_id: id,
      worker: "repair_route",
      result: "success",
      error_message: "Replayed via internal repair route",
      processed_at: new Date(),
    });

    success(res, { replayed: true, eventId: id });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/events/:id/cancel
router.post("/internal/events/:id/cancel", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;
    const schema = z.object({ reason: z.string().min(1) });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "reason is required", 422);
      return;
    }

    const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!event) {
      failure(res, "NOT_FOUND", "Event not found", 404);
      return;
    }

    await db.update(events).set({ status: "cancelled" }).where(eq(events.id, id));

    await db.insert(eventLogs).values({
      event_id: id,
      worker: "repair_route",
      result: "failed",
      error_message: `Cancelled: ${result.data.reason}`,
      processed_at: new Date(),
    });

    success(res, { cancelled: true, eventId: id, reason: result.data.reason });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/dead-letter
router.get("/internal/dead-letter", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const dlEvents = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.resolved, false))
      .orderBy(desc(deadLetterEvents.created_at))
      .limit(100);
    success(res, { events: dlEvents, count: dlEvents.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/internal/dead-letter/:id/resolve
router.post("/internal/dead-letter/:id/resolve", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const { id } = req.params;
    const schema = z.object({
      action: z.enum(["skip", "mark_resolved"]),
      reason: z.string().min(1),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "action and reason are required", 422);
      return;
    }

    const [dlEvent] = await db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.id, id))
      .limit(1);

    if (!dlEvent) {
      failure(res, "NOT_FOUND", "Dead letter event not found", 404);
      return;
    }

    await db
      .update(deadLetterEvents)
      .set({ resolved: true, reviewed: true, reviewed_at: new Date() })
      .where(eq(deadLetterEvents.id, id));

    success(res, { resolved: true, action: result.data.action, reason: result.data.reason });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/internal/events/health
router.get("/internal/events/health", async (req, res) => {
  try {
    await requireAuth(req, "INTERNAL_SERVICE");
    const health = await getEventSystemHealth();
    success(res, health);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
