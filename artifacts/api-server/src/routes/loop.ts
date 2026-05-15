import { Router } from "express";
import { z } from "zod";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { guaranteeTask } from "../engines/task-guarantee/ContinuousTaskGuaranteeEngine.js";
import { enterLoop } from "../engines/execution-loop/ExecutionLoopEngine.js";

const router = Router();

const guaranteeBodySchema = z.object({
  blueprintId: z.string().uuid().optional(),
  generationMode: z.string().optional(),
});

// POST /api/tasks/guarantee — force continuous-task guarantee check
router.post("/tasks/guarantee", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = guaranteeBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const [bp] = parsed.data.blueprintId
      ? await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(
            and(eq(blueprints.id, parsed.data.blueprintId), eq(blueprints.user_id, auth.userId)),
          )
          .limit(1)
      : await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
          .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    const result = await guaranteeTask({
      blueprintId: bp.id,
      userId: auth.userId,
      generationMode: parsed.data.generationMode ?? "guarantee_check",
      generationTrigger: "api_guarantee",
    });

    success(res, {
      blueprintId: bp.id,
      state: result.state,
      orderId: result.orderId ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/loop/regenerate — manual primary-loop regeneration
router.post("/loop/regenerate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.body?.blueprintId === "string" ? req.body.blueprintId : undefined;

    const [bp] = blueprintId
      ? await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
          .limit(1)
      : await db
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
          .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    await enterLoop({
      blueprintId: bp.id,
      userId: auth.userId,
      trigger: "manual_regeneration",
    });

    success(res, { blueprintId: bp.id, queued: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
