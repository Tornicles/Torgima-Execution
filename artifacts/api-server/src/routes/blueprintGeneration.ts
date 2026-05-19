import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import {
  getBlueprintGenerateReady,
  resolveBlueprintDomain,
  runFullBlueprintGenerationFlow,
} from "../services/BlueprintGenerationFlowService.js";
import { generateInterpretation } from "../bhudhi/agents/BlueprintAgent.js";
import { getBlueprintStructure } from "../engines/blueprint/BlueprintStructureService.js";
import { BlueprintRepository } from "../repositories/BlueprintRepository.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { ValidationService } from "../services/ValidationService.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";
import { db, orders, blueprints, validations } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/blueprint/generate-ready/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    if (req.params.userId !== auth.userId) {
      failure(res, "FORBIDDEN", "Cannot check readiness for another user", 403);
      return;
    }
    const ready = await getBlueprintGenerateReady(auth.userId);
    success(res, ready);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/blueprint/resolve-domain", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ blueprintId: z.string().uuid() }).parse(req.body);
    await BlueprintRepository.findById(body.blueprintId, auth.userId);
    const result = await resolveBlueprintDomain(body.blueprintId, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprint/launch — requires valid validation + selected path (Prompt 3)
router.post("/blueprint/launch", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z
      .object({
        blueprintId: z.string().uuid(),
        selectedPath: z.enum(["current", "adjusted", "alternative"]).optional(),
      })
      .parse(req.body);

    await BlueprintRepository.findById(body.blueprintId, auth.userId);

    if (body.selectedPath) {
      await ValidationService.selectValidationPath({
        blueprintId: body.blueprintId,
        userId: auth.userId,
        selectedPath: body.selectedPath,
        confirmAdjusted: body.selectedPath === "adjusted",
      });
    }

    await ValidationService.assertLaunchAllowed(body.blueprintId, auth.userId);
    const [erectorValidation] = await db
      .select()
      .from(validations)
      .where(eq(validations.blueprint_id, body.blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1);
    if (erectorValidation?.reality_score != null) {
      const resolution = erectorValidation.archetype_resolution as { primaryArchetype?: { id?: string; name?: string } } | null;
      await db
        .update(blueprints)
        .set({
          erector_validation_id: erectorValidation.id,
          primary_archetype_id: resolution?.primaryArchetype?.id?.startsWith("seed-") ? null : resolution?.primaryArchetype?.id ?? null,
          reality_score: erectorValidation.reality_score,
          chosen_blueprint_level: erectorValidation.recommended_blueprint_level,
          economy_briefing_summary: String((erectorValidation.economy_briefing as { briefingNarrative?: string } | null)?.briefingNarrative ?? "").slice(0, 500),
        })
        .where(eq(blueprints.id, body.blueprintId));
    }
    const result = await BlueprintService.activate(body.blueprintId, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/blueprint/generate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ blueprintId: z.string().uuid() }).parse(req.body);
    await BlueprintRepository.findById(body.blueprintId, auth.userId);
    const result = await runFullBlueprintGenerationFlow({
      userId: auth.userId,
      blueprintId: body.blueprintId,
    });
    success(res, result, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/blueprint/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const structure = await getBlueprintStructure(req.params.id);
    if (structure.blueprint.user_id !== auth.userId) {
      failure(res, "FORBIDDEN", "Not your blueprint", 403);
      return;
    }
    success(res, structure);
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/blueprint/:id/interpret", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    await BlueprintRepository.findById(req.params.id, auth.userId);
    const interpretation = await generateInterpretation(req.params.id, auth.userId);
    success(res, { interpretation });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/execution/next-task", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = z.object({ blueprintId: z.string().uuid().optional() }).parse(req.body ?? {});
    let targetBlueprintId = body.blueprintId;
    if (!targetBlueprintId) {
      const rows = await BlueprintRepository.listForUser(auth.userId);
      targetBlueprintId = rows.find(r => r.active)?.id;
    }

    if (!targetBlueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    await writeEvent({
      eventType: EVENT_TYPES.TASK_GENERATION_REQUESTED,
      entityType: "blueprint",
      entityId: targetBlueprintId,
      userId: auth.userId,
      blueprintId: targetBlueprintId,
      payload: { trigger: "execution_next_task" },
      idempotencyKey: `next_task:${targetBlueprintId}:${Date.now()}`,
    });

    success(res, { queued: true, blueprintId: targetBlueprintId });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/execution/active-order", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    const activeOrders = await db
      .select()
      .from(orders)
      .where(
        blueprintId
          ? and(eq(orders.user_id, auth.userId), eq(orders.blueprint_id, blueprintId), eq(orders.status, "active"))
          : and(eq(orders.user_id, auth.userId), eq(orders.status, "active")),
      )
      .limit(1);
    success(res, { order: activeOrders[0] ?? null });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
