import { Router } from "express";
import { z } from "zod/v4";
import { db, blueprints, orders, orderKnowledgeLinks, knowledgeObjects } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { OrderService } from "../services/OrderService.js";
import { processFeedback } from "../engines/feedback/FeedbackProcessingEngine.js";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import {
  handleRouteError,
  requireExplicitIdempotencyKey,
} from "../lib/route-helpers.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";

const router = Router();

const feedbackBodySchema = z.object({
  completionStatus: z.enum(["completed", "partial", "failed", "skipped"]),
  score: z.number().int().min(0).max(10),
  reflection: z.string().min(10).max(5000),
  proofJson: z.record(z.string(), z.unknown()).optional(),
  blockerJson: z.record(z.string(), z.unknown()).optional(),
  durationMinutes: z.number().optional(),
  frictionScore: z.number().min(1).max(5).optional(),
  confidenceScore: z.number().min(1).max(5).optional(),
  idempotencyKey: z.string().min(1),
  expectedStateVersion: z.number().optional(),
});

const finishBodySchema = z.object({
  outputSummary: z.string().max(2000).optional(),
  proof: z.record(z.string(), z.unknown()).optional(),
  expectedStateVersion: z.number().optional(),
});

const blockBodySchema = z.object({
  blockerType: z.enum([
    "skill_gap",
    "resource_gap",
    "dependency",
    "decision_gap",
    "external_wait",
    "other",
  ]),
  blockerDescription: z.string().min(5).max(1000),
  dependencyReference: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1),
  expectedStateVersion: z.number().optional(),
});

// GET /api/orders/active
router.get("/orders/active", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const task = await OrderService.getPrimaryDashboardTask(auth.userId);

    if (!task) {
      success(res, { order: null });
      return;
    }

    success(res, {
      order: {
        id: task.id,
        stateVersion: task.stateVersion,
        blueprintId: task.blueprintId,
        title: task.title,
        instruction: task.instruction,
        expectedOutput: task.expectedOutput,
        definitionOfDone: task.definitionOfDone,
        whyItMatters: task.whyItMatters,
        difficulty: task.difficulty,
        taskType: task.taskType,
        timeEstimateMinutes: task.timeEstimateMinutes,
        proofRequired: task.proofRequired,
        proofType: task.proofType,
        proofDescription: task.proofDescription,
        status: task.status,
        domain: task.domain,
        priority: task.priority,
        knowledgeObjects: task.knowledgeObjects,
      },
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/orders/:id
router.get("/orders/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId)))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const linkRows = await db
      .select({
        kid: knowledgeObjects.id,
        title: knowledgeObjects.title,
        content: knowledgeObjects.content,
        type: knowledgeObjects.type,
      })
      .from(orderKnowledgeLinks)
      .innerJoin(knowledgeObjects, eq(orderKnowledgeLinks.knowledge_id, knowledgeObjects.id))
      .where(eq(orderKnowledgeLinks.order_id, order.id))
      .limit(3);

    success(res, {
      id: order.id,
      blueprintId: order.blueprint_id,
      title: order.title,
      instruction: order.instruction,
      expectedOutput: order.expected_output,
      definitionOfDone: order.definition_of_done,
      whyItMatters: order.why_it_matters,
      difficulty: order.difficulty,
      taskType: order.task_type,
      timeEstimateMinutes: order.time_estimate_minutes,
      proofRequired: order.proof_required,
      proofType: order.proof_type,
      proofDescription: order.proof_description,
      status: order.status,
      domain: order.domain,
      priority: order.priority,
      startedAt: order.started_at,
      finishedAt: order.finished_at,
      knowledgeObjects: linkRows.map((kl) => ({
        id: kl.kid,
        title: kl.title,
        content: kl.content,
        type: kl.type,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/start
router.post("/orders/:id/start", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;

    const [pending] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId), eq(orders.status, "pending")))
      .limit(1);

    if (!pending) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    await db
      .update(orders)
      .set({ status: "active", started_at: new Date() })
      .where(eq(orders.id, id));

    success(res, { started: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/feedback
router.post("/orders/:id/feedback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    const parsed = feedbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = Object.fromEntries(
        parsed.error.issues.map((x) => [x.path.join("."), [x.message]]),
      );
      failure(res, "VALIDATION_ERROR", "Invalid input", 422, { fieldErrors });
      return;
    }
    const body = parsed.data;

    const [orderRow] = await db
      .select({ blueprint_id: orders.blueprint_id })
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId)))
      .limit(1);

    if (!orderRow) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const result = await processFeedback({
      orderId: id,
      userId: auth.userId,
      blueprintId: orderRow.blueprint_id,
      completionStatus: body.completionStatus,
      score: body.score,
      reflection: body.reflection,
      proofJson: body.proofJson,
      blockerJson: body.blockerJson,
      durationMinutes: body.durationMinutes,
      frictionScore: body.frictionScore,
      confidenceScore: body.confidenceScore,
      idempotencyKey: body.idempotencyKey,
      expectedStateVersion: body.expectedStateVersion,
    });

    success(res, result);
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/finish
router.post("/orders/:id/finish", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const parsed = finishBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.id, id), eq(orders.user_id, auth.userId), inArray(orders.status, ["active", "paused"])),
      )
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const requiresProof = order.proof_required && (input.proof == null || Object.keys(input.proof).length === 0);
    const newStatus = requiresProof ? "needs_proof" : "needs_feedback";

    await db
      .update(orders)
      .set({
        status: newStatus,
        output_summary: input.outputSummary ?? null,
        proof_json: input.proof ?? null,
        finished_at: new Date(),
      })
      .where(eq(orders.id, id));

    success(res, {
      status: newStatus,
      orderId: id,
      requiresProof,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/block
router.post("/orders/:id/block", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    const parsed = blockBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, id),
          eq(orders.user_id, auth.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      )
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    await db
      .update(orders)
      .set({
        status: "blocked",
        blocker_type: input.blockerType,
        blocker_description: input.blockerDescription,
        dependency_reference: input.dependencyReference ?? null,
      })
      .where(eq(orders.id, id));

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "order",
      entityId: id,
      userId: auth.userId,
      blueprintId: order.blueprint_id,
      payload: {
        generation_mode: "post_feedback",
        generation_trigger: "task_blocked",
        blocker_type: input.blockerType,
      },
      idempotencyKey: `block_task_gen:${id}:${input.idempotencyKey}`,
    });

    success(res, { blocked: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/unblock — restore blocked order to active (Prompt 14 surface)
router.post("/orders/:id/unblock", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId), eq(orders.status, "blocked")))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Blocked order not found", 404);
      return;
    }

    await db
      .update(orders)
      .set({
        status: "active",
        blocker_type: null,
        blocker_description: null,
        dependency_reference: null,
      })
      .where(eq(orders.id, id));

    success(res, { unblocked: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/pause
router.post("/orders/:id/pause", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId), eq(orders.status, "active")))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Active order not found", 404);
      return;
    }

    await db.update(orders).set({ status: "paused" }).where(eq(orders.id, id));
    success(res, { paused: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/resume (paused → active)
router.post("/orders/:id/resume", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId), eq(orders.status, "paused")))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Paused order not found", 404);
      return;
    }

    await db.update(orders).set({ status: "active" }).where(eq(orders.id, id));
    success(res, { resumed: true, orderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// POST /api/orders/:id/reset
router.post("/orders/:id/reset", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    void requireExplicitIdempotencyKey(req, req.body as Record<string, unknown>);
    const id = req.params.id!;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId)))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, id));

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "order",
      entityId: id,
      userId: auth.userId,
      blueprintId: order.blueprint_id,
      payload: {
        generation_mode: "recovery",
        generation_trigger: "manual_regeneration",
      },
      idempotencyKey: `order_reset:${id}:${Date.now()}`,
    });

    success(res, { reset: true, previousOrderId: id });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
