/**
 * PROMPT 3 — Native Torgima calendar: events, conflicts, slots, notifications.
 */
import crypto from "node:crypto";
import {
  db,
  calendarEvents,
  calendarConflicts,
  calendarNotifications,
  calendarViewsPreferences,
  calendarTimeBlocks,
} from "@workspace/db";
import { and, asc, desc, eq, gte, lte, ne, isNull } from "drizzle-orm";

export const EVENT_COLORS: Record<string, string> = {
  order: "#3b82f6",
  study: "#22c55e",
  "principle-deadline": "#a855f7",
  meeting: "#f97316",
  "custom-block": "#6b7280",
};

export const CALENDAR_VIEWS = [
  "calendar",
  "kanban",
  "gantt",
  "list",
  "board",
  "table",
  "dashboard",
  "map",
] as const;

export type CalendarViewType = (typeof CALENDAR_VIEWS)[number];

const DEFAULT_BUFFER_MINUTES = 15;
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 20;

export function mapCalendarEvent(row: typeof calendarEvents.$inferSelect) {
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    sourceId: row.source_id,
    sourceType: row.source_type,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    priority: row.priority,
    isAllDay: row.is_all_day,
    location: row.location,
    locationCoordinates: row.location_coordinates as { lat: number; lng: number } | null,
    color: row.color,
    status: row.status,
  };
}

export async function getOrCreateViewPreferences(userId: string) {
  const [row] = await db
    .select()
    .from(calendarViewsPreferences)
    .where(eq(calendarViewsPreferences.user_id, userId))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(calendarViewsPreferences)
    .values({ user_id: userId })
    .returning();
  return created!;
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export async function getEventsInRange(params: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
  excludeEventId?: string;
  eventTypes?: string[];
}) {
  const conditions = [
    eq(calendarEvents.user_id, params.userId),
    ne(calendarEvents.status, "cancelled"),
    lte(calendarEvents.start_time, params.rangeEnd),
    gte(calendarEvents.end_time, params.rangeStart),
  ];
  if (params.excludeEventId) {
    conditions.push(ne(calendarEvents.id, params.excludeEventId));
  }

  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(asc(calendarEvents.start_time));

  if (params.eventTypes?.length) {
    return rows.filter((r) => params.eventTypes!.includes(r.event_type));
  }
  return rows;
}

export async function checkForConflicts(input: {
  userId: string;
  newEventStartTime: Date;
  newEventEndTime: Date;
  excludeEventId?: string;
  minimumBufferMinutes?: number;
}): Promise<{
  hasConflict: boolean;
  conflicts: Array<{ event1Id: string; event2Id: string; conflictType: string; existingTitle: string }>;
  suggestedAlternativeSlots: Array<{ startTime: Date; endTime: Date }>;
}> {
  const bufferMinutes = input.minimumBufferMinutes ?? DEFAULT_BUFFER_MINUTES;
  const existing = await getEventsInRange({
    userId: input.userId,
    rangeStart: new Date(input.newEventStartTime.getTime() - bufferMinutes * 60000),
    rangeEnd: new Date(input.newEventEndTime.getTime() + bufferMinutes * 60000),
    excludeEventId: input.excludeEventId,
  });

  const conflicts: Array<{
    event1Id: string;
    event2Id: string;
    conflictType: string;
    existingTitle: string;
  }> = [];

  for (const ev of existing) {
    const evStart = new Date(ev.start_time);
    const evEnd = new Date(ev.end_time);

    if (rangesOverlap(input.newEventStartTime, input.newEventEndTime, evStart, evEnd)) {
      conflicts.push({
        event1Id: ev.id,
        event2Id: "new-event",
        conflictType: "time-overlap",
        existingTitle: ev.title,
      });
      continue;
    }

    const minutesAfterExisting =
      (input.newEventStartTime.getTime() - evEnd.getTime()) / 60000;
    const minutesBeforeExisting =
      (evStart.getTime() - input.newEventEndTime.getTime()) / 60000;

    if (
      (minutesAfterExisting > 0 && minutesAfterExisting < bufferMinutes) ||
      (minutesBeforeExisting > 0 && minutesBeforeExisting < bufferMinutes)
    ) {
      conflicts.push({
        event1Id: ev.id,
        event2Id: "new-event",
        conflictType: "back-to-back-insufficient-buffer",
        existingTitle: ev.title,
      });
    }
  }

  const durationMs = input.newEventEndTime.getTime() - input.newEventStartTime.getTime();
  const suggestedAlternativeSlots = await findAvailableSlots({
    userId: input.userId,
    date: input.newEventStartTime,
    durationMinutes: Math.ceil(durationMs / 60000),
    excludeEventId: input.excludeEventId,
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestedAlternativeSlots,
  };
}

export async function findAvailableSlots(params: {
  userId: string;
  date: Date;
  durationMinutes: number;
  excludeEventId?: string;
}): Promise<Array<{ startTime: Date; endTime: Date }>> {
  const dayStart = new Date(params.date);
  dayStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(params.date);
  dayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

  const busy = await getEventsInRange({
    userId: params.userId,
    rangeStart: dayStart,
    rangeEnd: dayEnd,
    excludeEventId: params.excludeEventId,
  });

  const slots: Array<{ startTime: Date; endTime: Date }> = [];
  let cursor = dayStart.getTime();
  const durationMs = params.durationMinutes * 60000;
  const bufferMs = DEFAULT_BUFFER_MINUTES * 60000;

  const sorted = busy
    .map((b) => ({ start: new Date(b.start_time).getTime(), end: new Date(b.end_time).getTime() }))
    .sort((a, b) => a.start - b.start);

  for (const block of sorted) {
    if (block.start - cursor >= durationMs + bufferMs) {
      const startTime = new Date(cursor + bufferMs);
      const endTime = new Date(startTime.getTime() + durationMs);
      slots.push({ startTime, endTime });
      if (slots.length >= 3) break;
    }
    cursor = Math.max(cursor, block.end);
  }

  if (slots.length < 3 && dayEnd.getTime() - cursor >= durationMs) {
    const startTime = new Date(cursor + bufferMs);
    slots.push({
      startTime,
      endTime: new Date(startTime.getTime() + durationMs),
    });
  }

  return slots.slice(0, 3);
}

async function persistConflicts(
  userId: string,
  newEventId: string,
  conflicts: Array<{ event1Id: string; conflictType: string }>,
) {
  for (const c of conflicts) {
    if (c.event1Id === "new-event") continue;
    await db.insert(calendarConflicts).values({
      user_id: userId,
      event_1_id: c.event1Id,
      event_2_id: newEventId,
      conflict_type: c.conflictType,
    });
  }
}

export async function scheduleEventNotifications(eventId: string, userId: string, startTime: Date) {
  const triggers: Array<{ minutes: number; type: string }> = [
    { minutes: 15, type: "in-app" },
    { minutes: 60, type: "email" },
    { minutes: 1440, type: "in-app" },
  ];

  for (const t of triggers) {
    const scheduledSendAt = new Date(startTime.getTime() - t.minutes * 60000);
    if (scheduledSendAt <= new Date()) continue;
    await db.insert(calendarNotifications).values({
      event_id: eventId,
      user_id: userId,
      notification_type: t.type,
      trigger_minutes_before: t.minutes,
      scheduled_send_at: scheduledSendAt,
    });
  }
}

export async function createCalendarEvent(params: {
  userId: string;
  eventType: string;
  title: string;
  description?: string;
  sourceId?: string;
  sourceType: string;
  startTime: Date;
  endTime: Date;
  priority?: number;
  isAllDay?: boolean;
  location?: string;
  locationCoordinates?: { lat: number; lng: number };
  rejectOnConflict?: boolean;
}): Promise<{
  event?: ReturnType<typeof mapCalendarEvent>;
  conflictCheck: Awaited<ReturnType<typeof checkForConflicts>>;
  created: boolean;
}> {
  const durationMinutes = Math.max(
    1,
    Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000),
  );

  const conflictCheck = await checkForConflicts({
    userId: params.userId,
    newEventStartTime: params.startTime,
    newEventEndTime: params.endTime,
  });

  if (conflictCheck.hasConflict && params.rejectOnConflict !== false) {
    return { conflictCheck, created: false };
  }

  const sourceId = params.sourceId ?? crypto.randomUUID();
  const color = EVENT_COLORS[params.eventType] ?? EVENT_COLORS["custom-block"]!;

  const [existing] = await db
    .select({ id: calendarEvents.id })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.user_id, params.userId),
        eq(calendarEvents.source_id, sourceId),
        eq(calendarEvents.source_type, params.sourceType),
      ),
    )
    .limit(1);

  let row;
  if (existing) {
    [row] = await db
      .update(calendarEvents)
      .set({
        title: params.title,
        description: params.description,
        start_time: params.startTime,
        end_time: params.endTime,
        duration_minutes: durationMinutes,
        priority: params.priority ?? 3,
        location: params.location,
        location_coordinates: params.locationCoordinates,
        color,
        status: "scheduled",
        updated_at: new Date(),
      })
      .where(eq(calendarEvents.id, existing.id))
      .returning();
  } else {
    [row] = await db
      .insert(calendarEvents)
      .values({
        user_id: params.userId,
        event_type: params.eventType,
        title: params.title,
        description: params.description,
        source_id: sourceId,
        source_type: params.sourceType,
        start_time: params.startTime,
        end_time: params.endTime,
        duration_minutes: durationMinutes,
        priority: params.priority ?? 3,
        is_all_day: params.isAllDay ?? false,
        location: params.location,
        location_coordinates: params.locationCoordinates,
        color,
      })
      .returning();
  }

  if (conflictCheck.hasConflict && row) {
    await persistConflicts(
      params.userId,
      row.id,
      conflictCheck.conflicts.map((c) => ({ event1Id: c.event1Id, conflictType: c.conflictType })),
    );
  }

  await scheduleEventNotifications(row!.id, params.userId, params.startTime);

  return {
    event: mapCalendarEvent(row!),
    conflictCheck,
    created: true,
  };
}

export async function rescheduleCalendarEvent(params: {
  userId: string;
  eventId: string;
  startTime: Date;
  endTime: Date;
}) {
  const conflictCheck = await checkForConflicts({
    userId: params.userId,
    newEventStartTime: params.startTime,
    newEventEndTime: params.endTime,
    excludeEventId: params.eventId,
  });

  if (conflictCheck.hasConflict) {
    return { updated: false, conflictCheck };
  }

  const durationMinutes = Math.max(
    1,
    Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000),
  );

  const [row] = await db
    .update(calendarEvents)
    .set({
      start_time: params.startTime,
      end_time: params.endTime,
      duration_minutes: durationMinutes,
      status: "rescheduled",
      updated_at: new Date(),
    })
    .where(
      and(eq(calendarEvents.id, params.eventId), eq(calendarEvents.user_id, params.userId)),
    )
    .returning();

  return { updated: true, event: row ? mapCalendarEvent(row) : null, conflictCheck };
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  await db
    .update(calendarEvents)
    .set({ status: "cancelled", updated_at: new Date() })
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.user_id, userId)));
}

export async function listCalendarEvents(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  view?: string;
  filters?: string[];
}) {
  const rows = await getEventsInRange({
    userId: params.userId,
    rangeStart: params.startDate,
    rangeEnd: params.endDate,
    eventTypes: params.filters,
  });

  const events = rows.map(mapCalendarEvent);

  if (params.view === "kanban") {
    return { view: "kanban", columns: groupByStatus(events) };
  }
  if (params.view === "dashboard") {
    return { view: "dashboard", summary: buildDashboardSummary(events) };
  }
  if (params.view === "map") {
    return {
      view: "map",
      events: events.filter((e) => e.locationCoordinates),
    };
  }

  return { view: params.view ?? "calendar", events };
}

function groupByStatus(events: ReturnType<typeof mapCalendarEvent>[]) {
  const columns: Record<string, ReturnType<typeof mapCalendarEvent>[]> = {
    scheduled: [],
    "in-progress": [],
    completed: [],
    cancelled: [],
    rescheduled: [],
  };
  for (const e of events) {
    const key = e.status in columns ? e.status : "scheduled";
    columns[key]!.push(e);
  }
  return columns;
}

function buildDashboardSummary(events: ReturnType<typeof mapCalendarEvent>[]) {
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter(
    (e) => new Date(e.startTime).toISOString().slice(0, 10) === today,
  );
  const totalMinutes = todayEvents.reduce((s, e) => s + e.durationMinutes, 0);
  return {
    todayCount: todayEvents.length,
    todayHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalInRange: events.length,
    upcoming: events.slice(0, 5),
  };
}

export async function getTodaySchedule(userId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const rows = await getEventsInRange({ userId, rangeStart: start, rangeEnd: end });
  return rows.map(mapCalendarEvent);
}

export async function getUnresolvedConflicts(userId: string) {
  return db
    .select()
    .from(calendarConflicts)
    .where(and(eq(calendarConflicts.user_id, userId), isNull(calendarConflicts.resolved_at)))
    .orderBy(desc(calendarConflicts.detected_at));
}

export async function resolveConflict(params: {
  userId: string;
  conflictId: string;
  action: "rescheduled" | "cancelled" | "acknowledged";
}) {
  await db
    .update(calendarConflicts)
    .set({
      resolved_at: new Date(),
      resolution_action: params.action,
    })
    .where(
      and(
        eq(calendarConflicts.id, params.conflictId),
        eq(calendarConflicts.user_id, params.userId),
      ),
    );
}

export async function createTimeBlock(params: {
  userId: string;
  blockType: string;
  startTime: Date;
  endTime: Date;
  recurring?: boolean;
  recurrencePattern?: string;
}) {
  const check = await checkForConflicts({
    userId: params.userId,
    newEventStartTime: params.startTime,
    newEventEndTime: params.endTime,
  });
  if (check.hasConflict) return { created: false, conflictCheck: check };

  const [block] = await db
    .insert(calendarTimeBlocks)
    .values({
      user_id: params.userId,
      block_type: params.blockType,
      start_time: params.startTime,
      end_time: params.endTime,
      recurring: params.recurring ?? false,
      recurrence_pattern: params.recurrencePattern,
    })
    .returning();

  return { created: true, block };
}
