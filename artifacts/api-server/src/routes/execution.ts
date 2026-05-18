import { Router } from "express";
import { z } from "zod";
import { db, blueprints, orders, executionSessions, knowledgePackages } from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { runPrimaryLoop } from "../engines/execution-loop/runPrimaryLoop.js";
import { runDailyLoop } from "../engines/execution-loop/runDailyLoopUser.js";
import { generateNextTask } from "../engines/execution-loop/generateNextTask.js";
import { ensureActiveOrder } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { routeTrigger } from "../bhudhi/TriggerRouter.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";

const router = Router();

const feedbackBodySchema = z.object({
  orderId: z.string().uuid(),
  blueprintId: z.string().uuid(),
  completionStatus: z.enum(["completed", "failed", "skipped", "partial"]),
  feedbackText: z.string().optional(),
  score: z.number().int().min(1).max(10).optional(),
});

// POST /api/execution/feedback — Primary Loop
router.post("/execution/feedback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = feedbackBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const result = await runPrimaryLoop(auth.userId, {
      userId: auth.userId,
      blueprintId: parsed.data.blueprintId,
      orderId: parsed.data.orderId,
      completionStatus: parsed.data.completionStatus,
      feedbackText: parsed.data.feedbackText,
      score: parsed.data.score,
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/execution/active-order
router.get("/execution/active-order", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const daily = await runDailyLoop(auth.userId);
    const order = daily.activeOrder;
    const injection =
      order?.command_context &&
      typeof order.command_context === "object" &&
      "knowledgeInjection" in (order.command_context as object)
        ? (order.command_context as { knowledgeInjection?: unknown }).knowledgeInjection
        : null;

    success(res, { order, knowledgeInjection: injection, morningReport: daily.morningReport });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/execution/next-task
router.post("/execution/next-task", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.body?.blueprintId === "string" ? req.body.blueprintId : undefined;

    const result = await generateNextTask(auth.userId, {
      blueprintId,
      reason: "MANUAL_REQUEST",
      generationMode: "post_feedback",
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/execution/session
router.get("/execution/session", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [session] = await db
      .select()
      .from(executionSessions)
      .where(eq(executionSessions.user_id, auth.userId))
      .orderBy(desc(executionSessions.started_at))
      .limit(1);

    success(res, { session: session ?? null });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/execution/help
router.post("/execution/help", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId : undefined;
    if (!orderId) {
      failure(res, "VALIDATION_ERROR", "orderId required", 422);
      return;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.user_id, auth.userId)))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const world = await getWorldModel(auth.userId);
    const result = await routeTrigger({
      userId: auth.userId,
      blueprintId: order.blueprint_id,
      orderId: order.id,
      triggerType: "EXECUTION_SUPPORT",
      worldStateVersion: world?.stateVersion ?? 0,
      currentCondition: order.condition_at_generation ?? "stability",
      priority: "MEDIUM",
      payload: {
        orderTitle: order.title,
        instruction: order.instruction,
        domain: order.domain,
      },
    });

    success(res, { help: result.contextPacket, contract: result.promptContract });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/execution/history
router.get("/execution/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.user_id, auth.userId))
      .orderBy(desc(orders.created_at))
      .limit(limit);

    success(res, { orders: rows });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/execution/loop-status
router.get("/execution/loop-status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const ensured = await ensureActiveOrder(auth.userId);

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    let activeCount = 0;
    if (bp) {
      const rows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, bp.id),
            inArray(orders.status, ["pending", "active", "pre_generated"]),
          ),
        );
      activeCount = rows.length;
    }

    success(res, {
      healthy: activeCount > 0 || Boolean(ensured.orderId),
      activeOrderCount: activeCount,
      ensuredOrderId: ensured.orderId ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/knowledge/:domain/:actionType
router.get("/knowledge/:domain/:actionType", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const domain = String(req.params.domain ?? "");
    const actionType = String(req.params.actionType ?? "");

    const [pkg] = await db
      .select()
      .from(knowledgePackages)
      .where(
        and(eq(knowledgePackages.domain, domain), eq(knowledgePackages.action_type, actionType)),
      )
      .orderBy(desc(knowledgePackages.updated_at))
      .limit(1);

    if (!pkg) {
      failure(res, "NOT_FOUND", "Knowledge package not found", 404);
      return;
    }

    success(res, { package: pkg });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
