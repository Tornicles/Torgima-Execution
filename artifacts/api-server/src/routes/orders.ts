import { Router } from "express";
import { z } from "zod/v4";
import {
  db,
  orders,
  orderKnowledgeLinks,
  knowledgeObjects,
  actions,
  phases,
  projects,
  decisionTraces,
} from "@workspace/db";
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

function buildOrderCommandContext(params: {
  domain: string | null | undefined;
  actionName: string | null | undefined;
  phaseName: string | null | undefined;
  projectName: string | null | undefined;
  orderTitle: string;
}): {
  where: string;
  how: string;
  whatItUnlocks: string;
  contributesTo: string;
} {
  const domain = params.domain?.toLowerCase() ?? "general";
  const platformMap: Record<string, string> = {
    genesis:      "Your primary tools, notebook, calendar, or where you ship work",
    market:       "Your customer-facing channels, CRM, or growth stack",
    delivery:     "Your primary business tools, communication channels, or target platforms",
    continuity:   "Your tracking, journaling, or maintenance systems",
    business:     "Your primary business tools, communication channels, or target platforms",
    health:       "Your tracking app, gym, or health monitoring system",
    financial:    "Your financial accounts, spreadsheet, or investment platform",
    creative:     "Your creative tools, portfolio, or publishing platform",
    personal_growth: "Your learning platform, journal, or habit tracker",
    technology:   "Your development environment, GitHub, or deployment platform",
  };
  const where = platformMap[domain] ?? "The platform or environment most relevant to this action";
  const how =
    "Use the most direct path. If stuck for more than 10 minutes, document the blocker and submit feedback anyway.";
  return {
    where,
    how,
    whatItUnlocks: params.actionName ?? params.orderTitle,
    contributesTo: params.phaseName ?? params.projectName ?? "your current execution chain",
  };
}

const feedbackBodySchema = z.object({
  completionStatus: z.enum(["completed", "partial", "failed", "skipped"]),
  score: z.number().int().min(0).max(10),
  reflection: z.string().min(10).max(5000),
  proofJson: z.record(z.string(), z.unknown()).nullish(),
  blockerJson: z.record(z.string(), z.unknown()).nullish(),
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

// GET /api/orders/current — alias for primary active task (Prompt 5)
router.get("/orders/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const task = await OrderService.getPrimaryDashboardTask(auth.userId);
    if (!task) {
      success(res, { order: null });
      return;
    }
    success(res, { order: task });
  } catch (e) {
    handleRouteError(req, res, e);
  }
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
        priorityEngine: task.priorityEngine ?? null,
      },
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/orders/:id/decision-trace — Prompt 7 transparency ("Why this task?")
router.get("/orders/:id/decision-trace", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;

    const [order] = await db
      .select({ id: orders.id, blueprint_id: orders.blueprint_id })
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId)))
      .limit(1);

    if (!order) {
      failure(res, "NOT_FOUND", "Order not found", 404);
      return;
    }

    const traces = await db
      .select()
      .from(decisionTraces)
      .where(
        and(
          eq(decisionTraces.blueprint_id, order.blueprint_id),
          eq(decisionTraces.entity_id, id),
        ),
      )
      .orderBy(desc(decisionTraces.created_at))
      .limit(5);

    const primary = traces[0];
    success(res, {
      orderId: id,
      summary: primary?.reasoning ?? "This order was selected from your active blueprint execution chain.",
      decisionType: primary?.decision_type ?? "task_selection",
      inputs: primary?.inputs_json ?? {},
      outputs: primary?.outputs_json ?? {},
      traces: traces.map((t) => ({
        id: t.id,
        decisionType: t.decision_type,
        reasoning: t.reasoning,
        engine: t.engine,
        createdAt: t.created_at,
      })),
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

    const [joined] = await db
      .select({
        order: orders,
        actionName: actions.name,
        phaseName: phases.name,
        projectName: projects.name,
      })
      .from(orders)
      .leftJoin(actions, eq(orders.action_id, actions.id))
      .leftJoin(phases, eq(orders.linked_phase_id, phases.id))
      .leftJoin(projects, eq(orders.linked_project_id, projects.id))
      .where(and(eq(orders.id, id), eq(orders.user_id, auth.userId)))
      .limit(1);

    const order = joined?.order;
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

    const commandContextBase = buildOrderCommandContext({
      domain: order.domain,
      actionName: joined.actionName,
      phaseName: joined.phaseName,
      projectName: joined.projectName,
      orderTitle: order.title,
    });
    const storedCtx = order.command_context as Record<string, unknown> | null | undefined;
    const commandContext =
      storedCtx && typeof storedCtx === "object" && Object.keys(storedCtx).length > 0
        ? { ...commandContextBase, ...storedCtx }
        : commandContextBase;

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
      phaseName: joined.phaseName,
      projectName: joined.projectName,
      actionName: joined.actionName,
      commandContext,
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
      proofJson: body.proofJson ?? undefined,
      blockerJson: body.blockerJson ?? undefined,
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
