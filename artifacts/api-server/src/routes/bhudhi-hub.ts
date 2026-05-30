/**
 * Bhudhi Hub — intelligence layer dashboard API.
 */
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { blueprintIdFromQuery, requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { DashboardService } from "../services/DashboardService.js";
import { getOperationalRulesForCondition } from "../constants/conditionOperationalRules.js";
import { CONDITION_RULES, type Condition } from "../constants/conditions.js";
import {
  buildBhudhiHubPanels,
  dashboardToExplainContext,
} from "../lib/bhudhiHubPanels.js";
import {
  buildDeterministicExplanation,
  questionFromCatalog,
} from "../lib/bhudhiHubExplain.js";
import { explainState } from "../bhudhi/TriggerRouter.js";
import { db, bhudhiLogs, signalSnapshots, conditions, orders } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";

const router = Router();

const ACTION_DISPLAY: Record<string, string> = {
  recovery: "Stabilization",
  execution: "Execution",
  phase_checkpoint: "Review",
  growth_tasks: "Scaling",
  scale_tasks: "Scaling",
  phase_advance: "Expansion",
};

function displayActions(keys: string[]): string[] {
  return keys.map((k) => ACTION_DISPLAY[k] ?? k.replace(/_/g, " "));
}

// GET /api/bhudhi/hub
router.get("/bhudhi/hub", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = blueprintIdFromQuery(req);
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    const ok = await requireUserBlueprint(res, blueprintId, auth.userId);
    if (!ok) return;

    const dashboard = await DashboardService.getDashboardState(auth.userId);
    if (!dashboard.activeBlueprint || dashboard.activeBlueprint.id !== blueprintId) {
      failure(res, "NOT_FOUND", "Active blueprint required for Bhudhi Hub", 404);
      return;
    }

    const hub = await buildBhudhiHubPanels({
      userId: auth.userId,
      blueprintId,
      dashboard,
    });

    success(res, { hub, blueprintId });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/hub/explain
router.post("/bhudhi/hub/explain", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        questionKey: z.string().min(1),
        glanceKey: z
          .enum(["condition", "momentum", "focus", "goal_progress"])
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId and questionKey required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const catalogQ = questionFromCatalog(parsed.data.questionKey);
    let questionKey = parsed.data.questionKey;
    if (parsed.data.glanceKey === "condition") questionKey = "why_this_condition";
    if (parsed.data.glanceKey === "momentum") questionKey = "why_momentum_level";
    if (parsed.data.glanceKey === "focus") questionKey = "why_this_focus";
    if (parsed.data.glanceKey === "goal_progress") questionKey = "goal_progress_drivers";

    const dashboard = await DashboardService.getDashboardState(auth.userId);
    const condition = (
      (dashboard.conditionDetail as { condition?: string } | null)?.condition ??
      dashboard.signals?.condition ??
      "stability"
    ).toLowerCase();
    const rules = getOperationalRulesForCondition(condition);
    const condRules = CONDITION_RULES[condition as Condition];
    const allowed = displayActions(rules?.allowedActions ?? condRules?.allowedTypes ?? []);
    const restricted = displayActions(rules?.restrictedActions ?? []);

    const ctx = dashboardToExplainContext(dashboard, allowed, restricted);
    const deterministic = buildDeterministicExplanation(questionKey, ctx);

    let aiEnrichment: Record<string, unknown> | null = null;
    let fallbackUsed = true;

    const bp = dashboard.activeBlueprint;
    if (bp && ["why_this_condition", "why_this_signal", "why_this_task"].includes(questionKey)) {
      try {
        const [signal] = await db
          .select()
          .from(signalSnapshots)
          .where(
            and(
              eq(signalSnapshots.blueprint_id, parsed.data.blueprintId),
              eq(signalSnapshots.is_current, true),
            ),
          )
          .limit(1);
        const [conditionRow] = await db
          .select()
          .from(conditions)
          .where(
            and(
              eq(conditions.blueprint_id, parsed.data.blueprintId),
              eq(conditions.is_current, true),
            ),
          )
          .limit(1);
        const [order] = await db
          .select({ title: orders.title })
          .from(orders)
          .where(
            and(
              eq(orders.blueprint_id, parsed.data.blueprintId),
              eq(orders.user_id, auth.userId),
              inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
            ),
          )
          .orderBy(desc(orders.priority))
          .limit(1);

        const result = await explainState({
          userId: auth.userId,
          blueprintId: parsed.data.blueprintId,
          stateVersion: (bp as { stateVersion?: number }).stateVersion ?? 0,
          condition: conditionRow?.condition ?? condition,
          completionRate: signal?.completion_rate ?? ctx.completionRate,
          weightedScore: signal?.weighted_score ?? 0,
          momentum: signal?.momentum ?? ctx.momentum,
          trend: signal?.trend ?? "stable",
          goal: (bp as { rawGoal?: string; title?: string }).rawGoal ?? bp.title ?? "",
          currentTaskTitle: order?.title ?? ctx.currentTaskTitle ?? undefined,
          conditionDuration: conditionRow?.duration_days ?? ctx.conditionDurationDays,
        });
        if (result.output?.data && !result.fallbackUsed) {
          aiEnrichment = result.output.data as Record<string, unknown>;
          fallbackUsed = false;
        }
      } catch {
        /* deterministic only */
      }
    }

    await db.insert(bhudhiLogs).values({
      user_id: auth.userId,
      blueprint_id: parsed.data.blueprintId,
      request_type: "condition_explanation",
      trigger_type: "state_explanation",
      input_json: {
        questionKey,
        question: catalogQ?.label ?? deterministic.title,
        glanceKey: parsed.data.glanceKey ?? null,
      },
      output_json: deterministic,
      fallback_used: fallbackUsed,
    });

    success(res, {
      questionKey,
      label: catalogQ?.label ?? deterministic.title,
      explanation: deterministic,
      aiEnrichment,
      fallbackUsed,
      principle: "Bhudhi explains. You decide. You execute.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
