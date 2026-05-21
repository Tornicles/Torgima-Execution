/**
 * PROMPT 4 — Multi-channel notification delivery, DND, preferences.
 */
import {
  db,
  users,
  userNotificationChannels,
  channelNotificationPreferences,
  notificationDeliveryQueue,
  notificationDeliveryHistory,
  doNotDisturbSchedules,
  inAppNotifications,
} from "@workspace/db";
import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { sendEmail, EMAIL_FROM } from "../../lib/resend.js";
import { logger } from "../../lib/logger.js";

export const CHANNEL_TYPES = ["push", "in-app", "slack", "discord", "telegram", "email", "sms"] as const;

export const NOTIFICATION_TYPES = [
  "order-due",
  "blocker",
  "principle-due",
  "study-session",
  "engagement-milestone",
  "status-change",
  "system",
] as const;

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export async function isUserInDnd(userId: string): Promise<boolean> {
  const [dnd] = await db
    .select()
    .from(doNotDisturbSchedules)
    .where(eq(doNotDisturbSchedules.user_id, userId))
    .limit(1);
  if (!dnd?.enabled) return false;

  const now = new Date();
  const day = now.getUTCDay();
  const days = (dnd.days_of_week as number[]) ?? [0, 1, 2, 3, 4, 5, 6];
  if (!days.includes(day)) return false;

  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = parseTimeMinutes(dnd.start_time);
  const end = parseTimeMinutes(dnd.end_time);
  if (start <= end) return mins >= start && mins < end;
  return mins >= start || mins < end;
}

export async function getConnectedChannels(userId: string) {
  return db
    .select()
    .from(userNotificationChannels)
    .where(
      and(
        eq(userNotificationChannels.user_id, userId),
        eq(userNotificationChannels.is_connected, true),
      ),
    );
}

export async function connectChannel(params: {
  userId: string;
  channelType: string;
  identifier: string;
  oauthToken?: string;
}) {
  const [row] = await db
    .insert(userNotificationChannels)
    .values({
      user_id: params.userId,
      channel_type: params.channelType,
      is_connected: true,
      channel_identifier: params.identifier,
      oauth_token_encrypted: params.oauthToken,
      connected_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [userNotificationChannels.user_id, userNotificationChannels.channel_type],
      set: {
        is_connected: true,
        channel_identifier: params.identifier,
        oauth_token_encrypted: params.oauthToken,
        connected_at: new Date(),
        disconnected_at: null,
        updated_at: new Date(),
      },
    })
    .returning();

  await ensureDefaultPreferences(params.userId, params.channelType);
  return row;
}

async function ensureDefaultPreferences(userId: string, channelType: string) {
  for (const nt of NOTIFICATION_TYPES) {
    await db
      .insert(channelNotificationPreferences)
      .values({
        user_id: userId,
        channel_type: channelType,
        notification_type: nt,
        enabled: channelType === "email" || channelType === "in-app",
        priority: 3,
        batch_frequency: "immediate",
      })
      .onConflictDoNothing();
  }
}

export async function disconnectChannel(userId: string, channelId: string) {
  await db
    .update(userNotificationChannels)
    .set({
      is_connected: false,
      disconnected_at: new Date(),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(userNotificationChannels.id, channelId),
        eq(userNotificationChannels.user_id, userId),
      ),
    );
}

export async function getChannelPreferences(userId: string) {
  return db
    .select()
    .from(channelNotificationPreferences)
    .where(eq(channelNotificationPreferences.user_id, userId));
}

export async function upsertChannelPreference(params: {
  userId: string;
  channelType: string;
  notificationType: string;
  enabled?: boolean;
  priority?: number;
  deliveryTimeWindowStart?: string;
  deliveryTimeWindowEnd?: string;
  batchFrequency?: string;
}) {
  const [row] = await db
    .insert(channelNotificationPreferences)
    .values({
      user_id: params.userId,
      channel_type: params.channelType,
      notification_type: params.notificationType,
      enabled: params.enabled ?? true,
      priority: params.priority ?? 3,
      delivery_time_window_start: params.deliveryTimeWindowStart,
      delivery_time_window_end: params.deliveryTimeWindowEnd,
      batch_frequency: params.batchFrequency ?? "immediate",
    })
    .onConflictDoUpdate({
      target: [
        channelNotificationPreferences.user_id,
        channelNotificationPreferences.channel_type,
        channelNotificationPreferences.notification_type,
      ],
      set: {
        enabled: params.enabled ?? true,
        priority: params.priority ?? 3,
        delivery_time_window_start: params.deliveryTimeWindowStart,
        delivery_time_window_end: params.deliveryTimeWindowEnd,
        batch_frequency: params.batchFrequency ?? "immediate",
        updated_at: new Date(),
      },
    })
    .returning();
  return row;
}

export async function setDoNotDisturb(params: {
  userId: string;
  startTime: string;
  endTime: string;
  daysOfWeek?: number[];
  timezone?: string;
  enabled?: boolean;
}) {
  const [existing] = await db
    .select()
    .from(doNotDisturbSchedules)
    .where(eq(doNotDisturbSchedules.user_id, params.userId))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(doNotDisturbSchedules)
      .set({
        start_time: params.startTime,
        end_time: params.endTime,
        days_of_week: params.daysOfWeek ?? (existing.days_of_week as number[]),
        timezone: params.timezone ?? existing.timezone,
        enabled: params.enabled ?? true,
        updated_at: new Date(),
      })
      .where(eq(doNotDisturbSchedules.user_id, params.userId))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(doNotDisturbSchedules)
    .values({
      user_id: params.userId,
      start_time: params.startTime,
      end_time: params.endTime,
      days_of_week: params.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6],
      timezone: params.timezone ?? "UTC",
      enabled: params.enabled ?? true,
    })
    .returning();
  return row;
}

export async function getDoNotDisturb(userId: string) {
  const [row] = await db
    .select()
    .from(doNotDisturbSchedules)
    .where(eq(doNotDisturbSchedules.user_id, userId))
    .limit(1);
  return row ?? null;
}

export async function enqueueNotification(params: {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  priority?: number;
  channelsToSend?: string[];
  scheduledFor?: Date;
}) {
  const channels =
    params.channelsToSend ??
    (params.priority && params.priority >= 4
      ? ["in-app", "push", "email", "sms"]
      : ["in-app", "email"]);

  const [row] = await db
    .insert(notificationDeliveryQueue)
    .values({
      user_id: params.userId,
      notification_type: params.notificationType,
      title: params.title,
      body: params.body,
      priority: params.priority ?? 3,
      channels_to_send: channels,
      scheduled_for: params.scheduledFor ?? new Date(),
    })
    .returning();

  return row;
}

export async function routeAndSendNotification(params: {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  priority?: number;
  channelsToSend?: string[];
}) {
  const inDnd = await isUserInDnd(params.userId);
  if (inDnd && (params.priority ?? 3) < 4) {
    return enqueueNotification({ ...params, scheduledFor: new Date(Date.now() + 3600000) });
  }
  const row = await enqueueNotification(params);
  await deliverQueuedNotification(row!.id);
  return row;
}

async function deliverChannel(
  userId: string,
  channelType: string,
  title: string,
  body: string,
  queueId: string,
) {
  if (channelType === "in-app" || channelType === "push") {
    await db.insert(inAppNotifications).values({
      user_id: userId,
      title,
      body,
      notification_type: "delivery",
      priority: 3,
    });
    await logDelivery(userId, queueId, channelType, "sent");
    return;
  }

  if (channelType === "email") {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (user?.email) {
      const result = await sendEmail({
        from: `Torgima <${EMAIL_FROM}>`,
        to: user.email,
        subject: title,
        html: `<h2>${title}</h2><p>${body}</p>`,
      });
      await logDelivery(userId, queueId, channelType, result.sent ? "sent" : "failed");
      return;
    }
  }

  const [channel] = await db
    .select()
    .from(userNotificationChannels)
    .where(
      and(
        eq(userNotificationChannels.user_id, userId),
        eq(userNotificationChannels.channel_type, channelType),
        eq(userNotificationChannels.is_connected, true),
      ),
    )
    .limit(1);

  if (!channel) {
    await logDelivery(userId, queueId, channelType, "skipped");
    return;
  }

  if (channelType === "slack" && channel.oauth_token_encrypted) {
    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${channel.oauth_token_encrypted}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: channel.channel_identifier,
          text: `*${title}*\n${body}`,
        }),
      });
      await logDelivery(userId, queueId, channelType, "sent");
    } catch {
      await logDelivery(userId, queueId, channelType, "failed");
    }
    return;
  }

  if (channelType === "telegram" && channel.channel_identifier) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: channel.channel_identifier,
            text: `${title}\n${body}`,
          }),
        });
        await logDelivery(userId, queueId, channelType, "sent");
      } catch {
        await logDelivery(userId, queueId, channelType, "failed");
      }
      return;
    }
  }

  logger.info({ userId, channelType }, "[NotificationDelivery] Channel stub — logged only");
  await logDelivery(userId, queueId, channelType, "stub");
}

async function logDelivery(
  userId: string,
  queueId: string,
  channelType: string,
  status: string,
) {
  await db.insert(notificationDeliveryHistory).values({
    user_id: userId,
    queue_id: queueId,
    channel_type: channelType,
    status,
  });
}

export async function deliverQueuedNotification(queueId: string) {
  const [item] = await db
    .select()
    .from(notificationDeliveryQueue)
    .where(eq(notificationDeliveryQueue.id, queueId))
    .limit(1);
  if (!item || item.sent_at) return;

  const channels = (item.channels_to_send as string[]) ?? ["in-app"];
  const prefs = await getChannelPreferences(item.user_id);

  for (const ch of channels) {
    const pref = prefs.find(
      (p) => p.channel_type === ch && p.notification_type === item.notification_type,
    );
    if (pref && !pref.enabled) continue;
    await deliverChannel(item.user_id, ch, item.title, item.body, item.id);
  }

  await db
    .update(notificationDeliveryQueue)
    .set({ sent_at: new Date() })
    .where(eq(notificationDeliveryQueue.id, queueId));
}

export async function processNotificationQueue(limit = 30) {
  const due = await db
    .select()
    .from(notificationDeliveryQueue)
    .where(
      and(
        isNull(notificationDeliveryQueue.sent_at),
        lte(notificationDeliveryQueue.scheduled_for, new Date()),
      ),
    )
    .limit(limit);

  for (const item of due) {
    await deliverQueuedNotification(item.id);
  }
  return due.length;
}

export async function getInAppNotifications(userId: string, unreadOnly = false) {
  const conditions = [eq(inAppNotifications.user_id, userId)];
  if (unreadOnly) conditions.push(isNull(inAppNotifications.read_at));

  return db
    .select()
    .from(inAppNotifications)
    .where(and(...conditions))
    .orderBy(desc(inAppNotifications.created_at))
    .limit(50);
}

export async function markInAppRead(userId: string, notificationId: string) {
  await db
    .update(inAppNotifications)
    .set({ read_at: new Date() })
    .where(
      and(
        eq(inAppNotifications.id, notificationId),
        eq(inAppNotifications.user_id, userId),
      ),
    );
}

export async function getDeliveryHistory(userId: string, limit = 50) {
  return db
    .select()
    .from(notificationDeliveryHistory)
    .where(eq(notificationDeliveryHistory.user_id, userId))
    .orderBy(desc(notificationDeliveryHistory.delivery_timestamp))
    .limit(limit);
}
