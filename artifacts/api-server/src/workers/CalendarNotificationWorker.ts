/**
 * PROMPT 3 — Deliver due calendar notifications (15m, 1h, 1d before events).
 */
import { db, calendarNotifications, calendarEvents, users } from "@workspace/db";
import { and, eq, isNull, lte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { sendEmail, EMAIL_FROM } from "../lib/resend.js";

const POLL_MS = 60_000;

async function processDueNotifications() {
  const now = new Date();
  const due = await db
    .select({
      notification: calendarNotifications,
      event: calendarEvents,
      email: users.email,
    })
    .from(calendarNotifications)
    .innerJoin(calendarEvents, eq(calendarNotifications.event_id, calendarEvents.id))
    .innerJoin(users, eq(calendarNotifications.user_id, users.id))
    .where(
      and(
        isNull(calendarNotifications.sent_at),
        lte(calendarNotifications.scheduled_send_at, now),
      ),
    )
    .limit(50);

  for (const row of due) {
    try {
      if (row.notification.notification_type === "email" && row.email) {
        await sendEmail({
          from: `Torgima <${EMAIL_FROM}>`,
          to: row.email,
          subject: `Upcoming: ${row.event.title}`,
          html: `<p>Your calendar event <strong>${row.event.title}</strong> starts at ${new Date(row.event.start_time).toLocaleString()}.</p>`,
        });
      }

      await db
        .update(calendarNotifications)
        .set({ sent_at: new Date() })
        .where(eq(calendarNotifications.id, row.notification.id));

      logger.info(
        {
          eventId: row.event.id,
          type: row.notification.notification_type,
          minutes: row.notification.trigger_minutes_before,
        },
        "[CalendarNotificationWorker] Sent",
      );
    } catch (err) {
      logger.warn(
        { err, notificationId: row.notification.id },
        "[CalendarNotificationWorker] Send failed",
      );
    }
  }
}

export function startCalendarNotificationPoller() {
  void processDueNotifications();
  setInterval(() => {
    void processDueNotifications();
  }, POLL_MS);
  logger.info("[CalendarNotificationWorker] Poller started");
}
