/**
 * PROMPT 3 — Sync orders, academy study, and principle deadlines to calendar.
 */
import crypto from "node:crypto";
import { db, orders, academyStudySessions } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createCalendarEvent } from "./CalendarEngine.js";

function stableSourceId(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function syncOrderToCalendar(orderId: string, userId: string) {
  const [order] = await db
    .select({
      title: orders.title,
      instruction: orders.instruction,
      due_at: orders.due_at,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return { synced: false };

  const start = order.due_at ? new Date(order.due_at) : defaultSlotToday();
  const duration = 60;
  const end = new Date(start.getTime() + duration * 60000);

  const result = await createCalendarEvent({
    userId,
    eventType: "order",
    title: order.title ?? "Execution order",
    description: order.instruction ?? undefined,
    sourceId: orderId,
    sourceType: "order",
    startTime: start,
    endTime: end,
    priority: 4,
    rejectOnConflict: true,
  });

  return { synced: result.created, event: result.event, conflictCheck: result.conflictCheck };
}

function defaultSlotToday(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export async function syncStudySessionToCalendarEvent(studySessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(academyStudySessions)
    .where(eq(academyStudySessions.id, studySessionId))
    .limit(1);

  if (!session || session.user_id !== userId) {
    throw new Error("Study session not found");
  }

  const [hours, minutes] = session.start_time.split(":").map(Number);
  const start = new Date(`${session.session_date}T00:00:00Z`);
  start.setUTCHours(hours ?? 14, minutes ?? 0, 0, 0);
  const end = new Date(start.getTime() + (session.duration_minutes ?? 45) * 60000);

  const result = await createCalendarEvent({
    userId,
    eventType: "study",
    title: "Academy study session",
    sourceId: studySessionId,
    sourceType: "academy-session",
    startTime: start,
    endTime: end,
    priority: 3,
    rejectOnConflict: true,
  });

  if (result.created && result.event) {
    await db
      .update(academyStudySessions)
      .set({
        synced_to_calendar: true,
        calendar_block_id: result.event.id,
      })
      .where(eq(academyStudySessions.id, studySessionId));
  }

  return {
    synced: result.created,
    calendarEventId: result.event?.id,
    conflictCheck: result.conflictCheck,
  };
}

export async function syncPrincipleDeadline(userId: string, principleDate?: string) {
  const dateStr = principleDate ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T23:00:00Z`);
  const end = new Date(`${dateStr}T23:59:00Z`);
  const sourceId = stableSourceId(`principle:${userId}:${dateStr}`);

  const result = await createCalendarEvent({
    userId,
    eventType: "principle-deadline",
    title: "365 Principle proof due",
    description: "Submit principle application proof before day end.",
    sourceId,
    sourceType: "principle",
    startTime: start,
    endTime: end,
    priority: 5,
    rejectOnConflict: false,
  });

  return result;
}
