import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  adminLogin,
  adminLogout,
  ADMIN_SESSION_COOKIE,
  isAdminPanelConfigured,
} from "../services/AdminAuthService.js";
import { requireAdminAuth, type AdminRequest } from "../middleware/requireAdminAuth.js";
import { logAdminAction } from "../services/adminActionLog.js";
import {
  addAdminSupportNote,
  getAdminActivityFeed,
  getAdminAnalyticsOverview,
  getAdminBhudhiUsage,
  getAdminConditionDistribution,
  getAdminOverviewKpis,
  getAdminSignupTrend,
  getAdminSystemHealth,
  getAdminUserDetail,
  listAdminAuditLog,
  listAdminDeadLetter,
  listAdminUsers,
  sendAdminSystemMessage,
  unlockUserBlueprint,
} from "../services/AdminDashboardService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { runStateIntegrityValidation } from "../engines/state/StateIntegrityValidator.js";
import { processFindings } from "../services/SystemHealthService.js";
import { deadLetterQueue } from "../services/DeadLetterQueue.js";
import { getEventSystemHealth } from "../services/EventDispatcher.js";
import { collectProductionMetrics } from "../services/MonitoringMetricsService.js";

const router = Router();
const prod = process.env.NODE_ENV === "production";

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
const adminCookieOptions = {
  httpOnly: true,
  secure: prod,
  sameSite: prod ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

// ── Auth (no middleware) ─────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    if (!isAdminPanelConfigured()) {
      failure(res, "FORBIDDEN", "Admin panel is not configured", 403);
      return;
    }
    const body = z.object({ email: z.string(), password: z.string().min(8) }).safeParse(req.body);
    if (!body.success) {
      failure(res, "VALIDATION_ERROR", "Invalid credentials payload", 422);
      return;
    }
    const { sessionId, email } = await adminLogin({
      email: body.data.email,
      password: body.data.password,
      ip: req.ip,
    });
    res.cookie(ADMIN_SESSION_COOKIE, sessionId, adminCookieOptions);
    success(res, { email });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const sessionId = req.cookies?.[ADMIN_SESSION_COOKIE] as string | undefined;
    if (sessionId) await adminLogout(sessionId);
    res.clearCookie(ADMIN_SESSION_COOKIE, { path: "/" });
    success(res, { loggedOut: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// ── Protected routes ─────────────────────────────────────────────────────────

const protectedRouter = Router();
protectedRouter.use(requireAdminAuth);

protectedRouter.get("/auth/me", (req: AdminRequest, res) => {
  success(res, { email: req.admin!.email });
});

protectedRouter.get("/dashboard/overview", async (req, res) => {
  try {
    const [kpis, health, activity, conditions, signups] = await Promise.all([
      getAdminOverviewKpis(),
      getAdminSystemHealth(),
      getAdminActivityFeed(20),
      getAdminConditionDistribution(),
      getAdminSignupTrend(7),
    ]);
    success(res, { kpis, health, activity, conditions, signups });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/users", async (req, res) => {
  try {
    const data = await listAdminUsers({
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 25,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      tier: typeof req.query.tier === "string" ? req.query.tier : undefined,
    });
    success(res, data);
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/users/:userId", async (req, res) => {
  try {
    const detail = await getAdminUserDetail(routeParam(req.params.userId));
    if (!detail) {
      failure(res, "NOT_FOUND", "User not found", 404);
      return;
    }
    success(res, detail);
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/health/system", async (req, res) => {
  try {
    success(res, await getAdminSystemHealth());
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/health/events", async (req, res) => {
  try {
    success(res, await getEventSystemHealth());
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/health/dead-letter", async (req, res) => {
  try {
    success(res, await listAdminDeadLetter());
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/health/dead-letter/:id/replay", async (req: AdminRequest, res) => {
  try {
    const result = await deadLetterQueue.replay(routeParam(req.params.id));
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "replay_dlq",
      payload: { dlqId: req.params.id, ...result },
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/health/dead-letter/:id/dismiss", async (req: AdminRequest, res) => {
  try {
    await deadLetterQueue.cancel(routeParam(req.params.id), `dismissed by ${req.admin!.email}`);
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "dismiss_dlq",
      payload: { dlqId: req.params.id },
    });
    success(res, { dismissed: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/analytics/overview", async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    success(res, await getAdminAnalyticsOverview(days));
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/analytics/signups", async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;
    success(res, { trend: await getAdminSignupTrend(days) });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/analytics/conditions", async (req, res) => {
  try {
    success(res, { distribution: await getAdminConditionDistribution() });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/bhudhi", async (req, res) => {
  try {
    success(res, await getAdminBhudhiUsage());
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/audit", async (req, res) => {
  try {
    success(
      res,
      await listAdminAuditLog({
        page: Number(req.query.page) || 1,
        actionType: typeof req.query.actionType === "string" ? req.query.actionType : undefined,
      }),
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/support/notes/:userId", async (req, res) => {
  try {
    const detail = await getAdminUserDetail(routeParam(req.params.userId));
    if (!detail) {
      failure(res, "NOT_FOUND", "User not found", 404);
      return;
    }
    success(res, { notes: detail.supportNotes });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/support/note/:userId", async (req: AdminRequest, res) => {
  try {
    const body = z.object({ note: z.string().min(1).max(5000) }).safeParse(req.body);
    if (!body.success) {
      failure(res, "VALIDATION_ERROR", "note is required", 422);
      return;
    }
    const row = await addAdminSupportNote({
      userId: routeParam(req.params.userId),
      note: body.data.note,
      adminEmail: req.admin!.email,
    });
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "support_note",
      targetUserId: routeParam(req.params.userId),
      payload: { noteId: row?.id },
    });
    success(res, { note: row });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/support/unlock/:userId", async (req: AdminRequest, res) => {
  try {
    const result = await unlockUserBlueprint(routeParam(req.params.userId));
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "unlock_blueprint",
      targetUserId: routeParam(req.params.userId),
      payload: result,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/support/task/:userId", async (req: AdminRequest, res) => {
  try {
    const detail = await getAdminUserDetail(routeParam(req.params.userId));
    if (!detail?.blueprint?.id) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    const result = await guaranteeTask({
      blueprintId: detail.blueprint.id,
      userId: routeParam(req.params.userId),
      generationTrigger: "admin_support",
    });
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "trigger_task_guarantee",
      targetUserId: routeParam(req.params.userId),
      payload: result as Record<string, unknown>,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/support/repair/:userId", async (req: AdminRequest, res) => {
  try {
    const validation = await runStateIntegrityValidation();
    await processFindings(validation.findings);
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "state_repair",
      targetUserId: routeParam(req.params.userId),
      payload: { findingCount: validation.findings.length },
    });
    success(res, { repaired: true, findingCount: validation.findings.length });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.post("/support/message/:userId", async (req: AdminRequest, res) => {
  try {
    const body = z.object({ message: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!body.success) {
      failure(res, "VALIDATION_ERROR", "message is required", 422);
      return;
    }
    const row = await sendAdminSystemMessage({
      userId: routeParam(req.params.userId),
      message: body.data.message,
    });
    await logAdminAction({
      adminEmail: req.admin!.email,
      actionType: "system_message",
      targetUserId: routeParam(req.params.userId),
      payload: { messageId: row?.id },
    });
    success(res, { sent: true, messageId: row?.id });
  } catch (err) {
    handleError(req, res, err);
  }
});

protectedRouter.get("/metrics", async (req, res) => {
  try {
    success(res, await collectProductionMetrics());
  } catch (err) {
    handleError(req, res, err);
  }
});

router.use(protectedRouter);

export default router;
