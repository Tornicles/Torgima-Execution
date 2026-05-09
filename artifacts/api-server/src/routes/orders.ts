import { Router } from "express";
import { z } from "zod/v4";
import {
  db,
  blueprints,
  orders,
  orderKnowledgeLinks,
  knowledgeObjects,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { OrderService } from "../services/OrderService.js";
import { UserService } from "../services/UserService.js";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { processFeedback } from "../engines/feedback/FeedbackProcessingEngine.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";

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

// GET /api/orders/active
router.get("/orders/active", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const [bp] = await db
      .select({
        id: blueprints.id,
        state_version: blueprints.state_version,
      })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!bp) {
      success(res, { order: null });
      return;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, bp.id),
          eq(orders.user_id, auth.userId),
          inArray(orders.status, ["pending", "active"]),
        ),
      )
      .orderBy(desc(orders.priority))
      .limit(1);

    if (!order) {
      success(res, { order: null });
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
      order: {
        id: order.id,
        stateVersion: bp.state_version,
        blueprintId: bp.id,
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
        knowledgeObjects: linkRows.map((k) => ({
          id: k.kid,
          title: k.title,
          content: k.content,
          type: k.type,
        })),
      },
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get active order", 500);
  }
});

// GET /api/orders/:id
router.get("/orders/:id", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.get(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/start
router.post("/orders/:id/start", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
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
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to start order", 500);
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
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Feedback submission failed", 500);
  }
});

// POST /api/orders/:id/finish
router.post("/orders/:id/finish", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.finish(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/block
router.post("/orders/:id/block", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const { reason } = req.body as { reason: string };
    const order = await OrderService.block(req.params.id!, user.id, reason);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/pause
router.post("/orders/:id/pause", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.pause(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/orders/:id/resume
router.post("/orders/:id/resume", async (req, res) => {
  try {
    const user = UserService.getDemoUser();
    const order = await OrderService.resume(req.params.id!, user.id);
    success(res, order);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
