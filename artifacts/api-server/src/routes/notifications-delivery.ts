import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, failure, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  CHANNEL_TYPES,
  connectChannel,
  disconnectChannel,
  getConnectedChannels,
  getChannelPreferences,
  upsertChannelPreference,
  setDoNotDisturb,
  getDoNotDisturb,
  routeAndSendNotification,
  getDeliveryHistory,
  getInAppNotifications,
  markInAppRead,
  isUserInDnd,
} from "../engines/notifications/NotificationDeliveryEngine.js";

const router = Router();

async function requireNotificationsEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.NOTIFICATIONS_MULTI_CHANNEL_ENABLED);
  if (!on) {
    throw new TorgimaError("FEATURE_DISABLED", "Multi-channel notifications are not enabled", false);
  }
}

router.get("/notifications/channels/connected", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const channels = await getConnectedChannels(auth.userId);
    success(res, { channels, available: CHANNEL_TYPES });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/notifications/channels/connect/:channelType", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const channelType = z
      .enum(["push", "in-app", "slack", "discord", "telegram", "email", "sms"])
      .parse(req.params.channelType);
    const body = z
      .object({
        identifier: z.string().min(1),
        code: z.string().optional(),
        oauthToken: z.string().optional(),
      })
      .parse(req.body);

    const row = await connectChannel({
      userId: auth.userId,
      channelType,
      identifier: body.identifier,
      oauthToken: body.oauthToken ?? body.code,
    });
    success(res, { channel: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.delete("/notifications/channels/:channelId", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    await disconnectChannel(auth.userId, req.params.channelId);
    success(res, { disconnected: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/notifications/preferences", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { preferences: await getChannelPreferences(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.put("/notifications/preferences", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        channelType: z.string(),
        notificationType: z.string(),
        enabled: z.boolean().optional(),
        priority: z.number().int().optional(),
        deliveryTimeWindowStart: z.string().optional(),
        deliveryTimeWindowEnd: z.string().optional(),
        batchFrequency: z.enum(["immediate", "hourly", "daily"]).optional(),
      })
      .parse(req.body);

    const row = await upsertChannelPreference({ userId: auth.userId, ...body });
    success(res, { preference: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/notifications/do-not-disturb", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const schedule = await getDoNotDisturb(auth.userId);
    const inDnd = await isUserInDnd(auth.userId);
    success(res, { schedule, currentlyActive: inDnd });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/notifications/do-not-disturb", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        startTime: z.string(),
        endTime: z.string(),
        daysOfWeek: z.array(z.number().int()).optional(),
        timezone: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .parse(req.body);

    const row = await setDoNotDisturb({ userId: auth.userId, ...body });
    success(res, { schedule: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/notifications/send", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        notificationType: z.string(),
        title: z.string(),
        body: z.string(),
        priority: z.number().int().optional(),
        channels: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const row = await routeAndSendNotification({
      userId: auth.userId,
      notificationType: body.notificationType,
      title: body.title,
      body: body.body,
      priority: body.priority,
      channelsToSend: body.channels,
    });
    success(res, { queued: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/notifications/in-app", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const unreadOnly = req.query.unread === "true";
    success(res, { notifications: await getInAppNotifications(auth.userId, unreadOnly) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/notifications/in-app/:id/read", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    await markInAppRead(auth.userId, req.params.id);
    success(res, { read: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/notifications/delivery-history", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, { history: await getDeliveryHistory(auth.userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/notifications/subscribe", async (req, res) => {
  try {
    await requireNotificationsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    await connectChannel({
      userId: auth.userId,
      channelType: "push",
      identifier: `push:${auth.userId}`,
    });
    success(res, { subscribed: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
