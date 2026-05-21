import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { success } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { FEATURE_FLAGS } from "../constants/feature-flags.js";
import { TorgimaError } from "../lib/errors.js";
import {
  computeDailyAnalytics,
  exportAnalyticsData,
  exportToCsv,
  generateAnalyticsInsights,
  getAcademyDashboard,
  getContentDashboard,
  getExecutionAnalyticsRange,
  getExecutionDashboard,
  getIntegratedDashboard,
  getPrinciplesDashboard,
  resolveDateRange,
} from "../engines/analytics/AnalyticsEngine.js";
import { db, executionVelocity, executionPatterns, failureAnalysis, productivityHeatmap, executionBenchmarks, principleEffectiveness } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";

const router = Router();
const timeWindowSchema = z.enum(["today", "week", "month", "all-time"]);

async function requireAnalyticsEnabled() {
  const { checkFeatureFlag } = await import("../lib/utils.js");
  const on = await checkFeatureFlag(FEATURE_FLAGS.ANALYTICS_ENABLED);
  if (!on) throw new TorgimaError("FEATURE_DISABLED", "Analytics is not enabled", false);
}

function assertSelf(authUserId: string, targetUserId: string) {
  if (authUserId !== targetUserId) {
    throw new TorgimaError("FORBIDDEN", "Can only access your own analytics", false);
  }
}

router.post("/analytics/compute", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const date = z.string().optional().parse(req.body?.date);
    await computeDailyAnalytics(auth.userId, date);
    success(res, { computed: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/execution/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.window);
    const { startStr, endStr } = resolveDateRange(
      tw,
      req.query.startDate as string | undefined,
      req.query.endDate as string | undefined,
    );
    const analytics = await getExecutionAnalyticsRange(userId, startStr, endStr);
    success(res, { analytics, window: tw });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/velocity/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const days = z.coerce.number().int().min(1).max(365).catch(30).parse(req.query.days);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await db
      .select()
      .from(executionVelocity)
      .where(
        and(
          eq(executionVelocity.user_id, userId),
          gte(executionVelocity.window_end_date, since.toISOString().slice(0, 10)),
        ),
      )
      .orderBy(desc(executionVelocity.created_at));
    success(res, { velocity: rows });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/patterns/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const patterns = await db
      .select()
      .from(executionPatterns)
      .where(eq(executionPatterns.user_id, userId))
      .orderBy(desc(executionPatterns.detected_at))
      .limit(20);
    success(res, { patterns });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/heatmap/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const heatmap = await db
      .select()
      .from(productivityHeatmap)
      .where(eq(productivityHeatmap.user_id, userId));
    success(res, { heatmap });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/benchmarks/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const benchmarks = await db
      .select()
      .from(executionBenchmarks)
      .where(eq(executionBenchmarks.user_id, userId));
    success(res, { benchmarks });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/failures/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const limit = z.coerce.number().int().min(1).max(50).catch(10).parse(req.query.limit);
    const failures = await db
      .select()
      .from(failureAnalysis)
      .where(eq(failureAnalysis.user_id, userId))
      .orderBy(desc(failureAnalysis.analyzed_at))
      .limit(limit);
    success(res, { failures });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/momentum/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const dashboard = await getExecutionDashboard(userId, "week");
    success(res, {
      momentum: dashboard.executionMomentum,
      completionRate: dashboard.completionRate,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/principles/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow ?? req.query.window);
    const dashboard = await getPrinciplesDashboard(userId, tw);
    success(res, { dashboard });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/principles/top-performing", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const top = await db
      .select()
      .from(principleEffectiveness)
      .where(eq(principleEffectiveness.user_id, auth.userId))
      .orderBy(desc(principleEffectiveness.effectiveness_score))
      .limit(5);
    success(res, { principles: top });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/academy/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow ?? req.query.window);
    success(res, { dashboard: await getAcademyDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/content/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow ?? req.query.window);
    success(res, { dashboard: await getContentDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/dashboard/execution/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow);
    success(res, { dashboard: await getExecutionDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/dashboard/principles/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow);
    success(res, { dashboard: await getPrinciplesDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/dashboard/academy/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow);
    success(res, { dashboard: await getAcademyDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/dashboard/content/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const tw = timeWindowSchema.catch("month").parse(req.query.timeWindow);
    success(res, { dashboard: await getContentDashboard(userId, tw) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/dashboard/integrated/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    success(res, { dashboard: await getIntegratedDashboard(userId) });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/analytics/insights/:userId", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = z.string().uuid().parse(req.params.userId);
    assertSelf(auth.userId, userId);
    const insights = await generateAnalyticsInsights(userId);
    success(res, { insights });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.post("/analytics/export", async (req, res) => {
  try {
    await requireAnalyticsEnabled();
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        startDate: z.string(),
        endDate: z.string(),
        format: z.enum(["csv", "json"]).default("json"),
      })
      .parse(req.body);

    const data = await exportAnalyticsData(auth.userId, body.startDate, body.endDate);
    if (body.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=torgima-analytics.csv");
      res.send(exportToCsv(data as Record<string, unknown>));
      return;
    }
    success(res, data);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
