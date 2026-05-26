import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { blueprints, db, miniPlanAllocationHistory, orders } from "@workspace/db";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { dailyTasksForCondition } from "../constants/conditionSpec.js";
import {
  buildQueueDayPattern,
  distributeDailyTaskCounts,
  getAllocationDashboardSpec,
  getAllocationForCondition,
  readCurrentAllocation,
} from "../engines/mini-plan/MiniPlanAllocationEngine.js";

const router = Router();

router.get("/mini-plans/allocation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ current_condition: blueprints.current_condition })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const condition = bp.current_condition ?? "stability";
    const allocation = getAllocationForCondition(condition);
    const current = await readCurrentAllocation(blueprintId);
    const dailyTotal = dailyTasksForCondition(condition);
    const dailyTaskCounts = distributeDailyTaskCounts(dailyTotal, allocation);
    const display = getAllocationDashboardSpec(condition);
    const todayPattern = buildQueueDayPattern(dailyTaskCounts);

    const history = await db
      .select()
      .from(miniPlanAllocationHistory)
      .where(eq(miniPlanAllocationHistory.blueprint_id, blueprintId))
      .orderBy(desc(miniPlanAllocationHistory.created_at))
      .limit(10);

    success(res, {
      condition,
      allocation,
      perPlan: current.perPlan,
      dailyTaskCounts,
      dailyTotal,
      todayPattern,
      display,
      userCanEdit: false,
      adaptsAutomatically: true,
      history: history.map((h) => ({
        date: h.created_at,
        condition: h.condition,
        allocation: h.allocation,
        previousCondition: h.previous_condition,
        reason: h.reason,
        tasksAffected: h.tasks_affected,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/mini-plans/queue-preview", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const [bp] = await db
      .select({ current_condition: blueprints.current_condition })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const condition = bp.current_condition ?? "stability";
    const allocation = getAllocationForCondition(condition);
    const dailyTotal = dailyTasksForCondition(condition);
    const counts = distributeDailyTaskCounts(dailyTotal, allocation);
    const defaultPattern = buildQueueDayPattern(counts);

    const hiddenOrders = await db
      .select({
        mini_plan_key: orders.mini_plan_key,
        visibility_date: orders.visibility_date,
        is_visible: orders.is_visible,
      })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, auth.userId),
          eq(orders.is_visible, false),
        ),
      )
      .orderBy(orders.visibility_date);

    const visibleToday = await db
      .select({ mini_plan_key: orders.mini_plan_key })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, auth.userId),
          eq(orders.is_visible, true),
        ),
      );

    const todayFromDb = visibleToday.map((o) => {
      const k = o.mini_plan_key ?? "Operations";
      if (k === "Foundation") return "F";
      if (k === "Growth") return "G";
      return "O";
    });

    const today = todayFromDb.length > 0 ? todayFromDb : defaultPattern;

    const byDay = new Map<string, string[]>();
    for (const o of hiddenOrders) {
      const d = o.visibility_date
        ? new Date(o.visibility_date).toISOString().slice(0, 10)
        : "unknown";
      const letter =
        o.mini_plan_key === "Foundation" ? "F" : o.mini_plan_key === "Growth" ? "G" : "O";
      const arr = byDay.get(d) ?? [];
      arr.push(letter);
      byDay.set(d, arr);
    }

    const sortedDays = [...byDay.keys()].sort().slice(0, 7);
    const nextSevenDays =
      sortedDays.length > 0
        ? sortedDays.map((day) => ({ day, pattern: byDay.get(day) ?? defaultPattern }))
        : Array.from({ length: 7 }, (_, i) => ({
            day: `day+${i + 1}`,
            pattern: defaultPattern,
          }));

    success(res, {
      condition,
      allocation,
      dailyTotal,
      dailyTaskCounts: counts,
      today,
      nextSevenDays,
      note: "Today's visible queue is unchanged. Hidden days regenerate when condition changes.",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
