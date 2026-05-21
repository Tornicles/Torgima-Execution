import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success, checkFeatureFlag } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import { verifyMagicLink } from "../services/AuthService.js";
import {
  connectWearableProvider,
  getMobileDashboardSummary,
  getWidgetData,
  processBatchSync,
  registerDeviceToken,
  saveHealthMetrics,
  submitQuickFeedback,
} from "../engines/mobile/MobileEngine.js";

const router = Router();

async function requireMobileEnabled() {
  const on = await checkFeatureFlag(FEATURE_FLAGS.MOBILE_APP_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Mobile app API is not enabled", false);
}

router.post("/mobile/auth/verify", async (req, res) => {
  try {
    await requireMobileEnabled();
    const body = z.object({ token: z.string(), email: z.string().email() }).parse(req.body);
    const { sessionToken, user } = await verifyMagicLink(body.token, body.email);
    success(res, { sessionToken, user, authenticated: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/mobile/widget-data", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const data = await getWidgetData(auth.userId);
    success(res, { widget: data });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/mobile/dashboard-summary", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const summary = await getMobileDashboardSummary(auth.userId);
    success(res, { summary });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/mobile/device-token", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "expo"]),
        deviceId: z.string().optional(),
        appVersion: z.string().optional(),
      })
      .parse(req.body);
    const row = await registerDeviceToken({
      userId: auth.userId,
      pushToken: body.token,
      platform: body.platform,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
    });
    success(res, { device: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/mobile/quick-feedback", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        orderId: z.string().uuid(),
        blueprintId: z.string().uuid(),
        status: z.enum(["completed", "partial", "failed", "skipped"]),
        score: z.number().int().min(1).max(10).optional(),
        reflection: z.string().optional(),
        idempotencyKey: z.string().optional(),
      })
      .parse(req.body);
    const result = await submitQuickFeedback({
      userId: auth.userId,
      ...body,
    });
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/mobile/sync/batch", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        actions: z.array(
          z.object({
            clientActionId: z.string().min(1),
            type: z.enum(["create", "update", "delete"]),
            resource: z.string().min(1),
            payload: z.record(z.unknown()),
          }),
        ),
      })
      .parse(req.body);
    const result = await processBatchSync(auth.userId, body.actions);
    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/mobile/health-metrics", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        steps: z.number().int().optional(),
        activeMinutes: z.number().int().optional(),
        caloriesBurned: z.number().int().optional(),
        heartRate: z.number().int().optional(),
        sleepHours: z.number().optional(),
        source: z.string().optional(),
        metricDate: z.string().optional(),
      })
      .parse(req.body);
    await saveHealthMetrics(auth.userId, body);
    success(res, { saved: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/mobile/wearable/connect", async (req, res) => {
  try {
    await requireMobileEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        provider: z.enum(["fitbit", "oura", "apple-health", "google-fit"]),
        oauthToken: z.string().optional(),
      })
      .parse(req.body);
    const row = await connectWearableProvider(auth.userId, body.provider, body.oauthToken);
    success(res, { connection: row });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
