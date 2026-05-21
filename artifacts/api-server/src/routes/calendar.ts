import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  CALENDAR_VIEWS,
  createCalendarEvent,
  rescheduleCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  checkForConflicts,
  findAvailableSlots,
  getTodaySchedule,
  getUnresolvedConflicts,
  resolveConflict,
  getOrCreateViewPreferences,
  createTimeBlock,
} from "../engines/calendar/CalendarEngine.js";
import { syncOrderToCalendar, syncPrincipleDeadline } from "../engines/calendar/CalendarSyncService.js";
import { db, calendarNotifications } from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";

const router = Router();

async function requireCalendarEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.CALENDAR_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Calendar is not enabled", false);
}

const eventBodySchema = z.object({
  eventType: z.enum(["order", "study", "principle-deadline", "meeting", "custom-block"]),
  title: z.string().min(1),
  description: z.string().optional(),
  sourceId: z.string().uuid().optional(),
  sourceType: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  priority: z.number().int().min(1).max(5).optional(),
  location: z.string().optional(),
  locationCoordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  rejectOnConflict: z.boolean().optional(),
});

router.get("/calendar/views/available", async (req, res) => {
  try {
    await requireCalendarEnabled();
    await requireAuth(req, "USER_SESSION");
    success(res, { views: CALENDAR_VIEWS });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/events", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const startDate = new Date(String(req.query.startDate ?? new Date().toISOString().slice(0, 10)));
    const end = new Date(String(req.query.endDate ?? Date.now() + 7 * 86400000));
    const view = req.query.view as string | undefined;
    const filters = req.query.filters
      ? String(req.query.filters).split(",")
      : undefined;

    const data = await listCalendarEvents({
      userId: auth.userId,
      startDate,
      endDate: end,
      view,
      filters,
    });
    success(res, data);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/today", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { events: await getTodaySchedule(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/events", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = eventBodySchema.parse(req.body);
    const result = await createCalendarEvent({
      userId: auth.userId,
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      sourceType: body.sourceType,
      rejectOnConflict: body.rejectOnConflict ?? true,
    });

    if (!result.created) {
      failure(res, "CONFLICT", "Calendar conflict detected", 409, {
        detail: JSON.stringify(result.conflictCheck),
      });
      return;
    }
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.put("/calendar/events/:eventId", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const startTime = new Date(z.string().datetime().parse(req.body.startTime));
    const endTime = new Date(z.string().datetime().parse(req.body.endTime));
    const result = await rescheduleCalendarEvent({
      userId: auth.userId,
      eventId: req.params.eventId,
      startTime,
      endTime,
    });
    if (!result.updated) {
      failure(res, "CONFLICT", "Reschedule blocked by conflict", 409, {
        detail: JSON.stringify(result.conflictCheck),
      });
      return;
    }
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.put("/calendar/events/:eventId/reschedule", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const startTime = new Date(z.string().datetime().parse(req.body.startTime));
    const endTime = new Date(z.string().datetime().parse(req.body.endTime));
    const result = await rescheduleCalendarEvent({
      userId: auth.userId,
      eventId: req.params.eventId,
      startTime,
      endTime,
    });
    if (!result.updated) {
      failure(res, "CONFLICT", "Reschedule blocked by conflict", 409, {
        detail: JSON.stringify(result.conflictCheck),
      });
      return;
    }
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.delete("/calendar/events/:eventId", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    await deleteCalendarEvent(auth.userId, req.params.eventId);
    success(res, { deleted: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/check-conflicts", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const startTime = new Date(z.string().datetime().parse(req.body.startTime));
    const endTime = new Date(z.string().datetime().parse(req.body.endTime));
    const excludeEventId = z.string().uuid().optional().parse(req.body.excludeEventId);
    success(
      res,
      await checkForConflicts({
        userId: auth.userId,
        newEventStartTime: startTime,
        newEventEndTime: endTime,
        excludeEventId,
      }),
    );
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/available-slots", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const date = new Date(String(req.query.date ?? new Date().toISOString().slice(0, 10)));
    const duration = Number(req.query.duration ?? 60);
    success(res, { slots: await findAvailableSlots({ userId: auth.userId, date, durationMinutes: duration }) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/conflicts/unresolved", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { conflicts: await getUnresolvedConflicts(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/conflicts/:userId", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    if (auth.userId !== req.params.userId) {
      failure(res, "FORBIDDEN", "Forbidden", 403);
      return;
    }
    success(res, { conflicts: await getUnresolvedConflicts(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/conflicts/:conflictId/resolve", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const action = z.enum(["rescheduled", "cancelled", "acknowledged"]).parse(req.body.action);
    await resolveConflict({ userId: auth.userId, conflictId: req.params.conflictId, action });
    success(res, { resolved: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/preferences", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { preferences: await getOrCreateViewPreferences(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/sync/order/:orderId", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await syncOrderToCalendar(req.params.orderId, auth.userId));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/sync/principle-deadline", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await syncPrincipleDeadline(auth.userId, req.body.principleDate));
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/calendar/notifications/pending", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const rows = await db
      .select()
      .from(calendarNotifications)
      .where(
        and(
          eq(calendarNotifications.user_id, auth.userId),
          isNull(calendarNotifications.read_at),
        ),
      )
      .orderBy(desc(calendarNotifications.scheduled_send_at))
      .limit(20);
    success(res, { notifications: rows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/notifications/subscribe", async (req, res) => {
  try {
    await requireCalendarEnabled();
    await requireAuth(req, "USER_SESSION");
    success(res, { subscribed: true, note: "Push subscription stored when VAPID is configured" });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/calendar/time-blocks", async (req, res) => {
  try {
    await requireCalendarEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        blockType: z.string(),
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
      })
      .parse(req.body);
    const result = await createTimeBlock({
      userId: auth.userId,
      blockType: body.blockType,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    });
    if (!result.created) {
      failure(res, "CONFLICT", "Time block conflicts with existing events", 409, {
        detail: JSON.stringify(result.conflictCheck),
      });
      return;
    }
    success(res, result, 201);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
