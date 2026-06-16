import { Router } from "express";
import {
  db,
  blueprints,
  plans,
  orders,
  conditionRecords,
  users,
  validations,
  sessions,
  magicLinkTokens,
  feedback as feedbackTable,
} from "@workspace/db";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { DashboardService } from "../services/DashboardService.js";
import { SignalService } from "../services/SignalService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { refreshDashboardIntelligence } from "../engines/dashboard/DashboardIntelligenceEngine.js";
import { ExternalIntelligenceService } from "../bhudhi/ExternalIntelligenceService.js";

const router = Router();

// GET /api/state/dashboard — aligns with OpenAPI DashboardState via DashboardService
router.get("/state/dashboard", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const limited = await DashboardService.getLimitedDashboardStateIfNeeded(auth.userId);
    if (limited) {
      success(res, limited);
      return;
    }
    const payload = await DashboardService.getDashboardState(auth.userId);
    success(res, { ...payload, mode: "full" });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/state/dashboard-intelligence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const payload = await refreshDashboardIntelligence(auth.userId, "SESSION_START");
    success(res, payload);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/dashboard/intelligence/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.blueprintId ?? "");
    const intelligence = await ExternalIntelligenceService.getLatestForBlueprint(blueprintId);
    success(res, {
      intelligence,
      freshnessStatus: intelligence ? ("fresh" as const) : ("none" as const),
      userId: auth.userId,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/state/signals — execution signals history for Progress screen
router.get("/state/signals", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;

    const history = await SignalService.getApiHistory(auth.userId, blueprintId, 30, 0);
    if (!history) {
      success(res, {
        blueprintId: null,
        currentSignal: null,
        signalHistory: [],
        conditionHistory: [],
        stats: { totalTasksCompleted: 0, daysActive: 0 },
      });
      return;
    }

    const current = await SignalService.getApiCurrent(auth.userId, history.blueprintId);
    const conditionRows = await db
      .select()
      .from(conditionRecords)
      .where(eq(conditionRecords.blueprint_id, history.blueprintId))
      .orderBy(desc(conditionRecords.created_at))
      .limit(10);

    const [completedRow] = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(eq(orders.blueprint_id, history.blueprintId), eq(orders.status, "completed")),
      );

    const [bp] = await db
      .select({
        createdAt: blueprints.created_at,
        selectionConfirmedAt: blueprints.selection_confirmed_at,
      })
      .from(blueprints)
      .where(eq(blueprints.id, history.blueprintId))
      .limit(1);

    const anchor = bp?.selectionConfirmedAt ?? bp?.createdAt ?? new Date();
    const daysActive = Math.max(
      0,
      Math.floor((Date.now() - anchor.getTime()) / (1000 * 60 * 60 * 24)),
    );

    success(res, {
      blueprintId: history.blueprintId,
      currentSignal: current.signal,
      signalHistory: history.snapshots,
      conditionHistory: conditionRows,
      stats: {
        totalTasksCompleted: Number(completedRow?.count ?? 0),
        daysActive,
      },
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/state/project — blueprint hierarchy for Project screen
router.get("/state/project", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [blueprint] = await db
      .select()
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!blueprint) {
      failure(res, "NO_BLUEPRINT", "No active project found.", 404);
      return;
    }

    const planRows = await db
      .select()
      .from(plans)
      .where(eq(plans.blueprint_id, blueprint.id))
      .orderBy(asc(plans.order_index));

    const currentPlanId = blueprint.current_plan_id ?? planRows[0]?.id ?? null;
    const currentPlanIndex = planRows.findIndex((p) => p.id === currentPlanId);
    const currentPlan = currentPlanIndex >= 0 ? planRows[currentPlanIndex] : planRows[0];

    success(res, {
      blueprint: {
        id: blueprint.id,
        projectName: blueprint.project_name ?? blueprint.goal?.substring(0, 40),
        goal: blueprint.goal,
        tier: blueprint.tier ?? blueprint.blueprint_tier ?? "starter",
        launchedAt: blueprint.selection_confirmed_at ?? blueprint.created_at,
      },
      plans: planRows,
      currentPosition: {
        planId: currentPlan?.id ?? null,
        planName: currentPlan?.name ?? currentPlan?.title ?? "Foundation",
        planNumber: currentPlanIndex >= 0 ? currentPlanIndex + 1 : 1,
        totalPlans: planRows.length,
        percentComplete: 0,
      },
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
