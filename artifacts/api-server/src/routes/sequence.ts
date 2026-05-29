import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { SequenceTrackingService } from "../services/SequenceTrackingService.js";
import { SequenceOrchestrationService } from "../services/SequenceOrchestrationService.js";
import { processFeedbackRegeneration } from "../engines/sequence/sequenceRegenerationEngine.js";
import { computeSceneFromBlueprint } from "../engines/sequence/sequenceSceneEngine.js";
import { syncTaskGenerationSequence } from "../engines/sequence/sequenceTaskQueueService.js";
import { ValidationService } from "../services/ValidationService.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function assertBlueprintAccess(blueprintId: string, userId: string) {
  const [row] = await db
    .select({ user_id: blueprints.user_id })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  return row?.user_id === userId;
}

async function loadTier(blueprintId: string) {
  const [bp] = await db.select({ tier: blueprints.tier }).from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  return bp?.tier;
}

// GET /api/blueprints/:blueprintId/sequence
router.get("/blueprints/:blueprintId/sequence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    await SequenceTrackingService.ensureInitialized(blueprintId, tier);
    const status = await SequenceTrackingService.getStatus(blueprintId);
    success(res, status ?? { blueprintId, initialized: false });
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 3B — POST /api/sequences/goal
router.post("/sequences/goal", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), goalText: z.string().min(3) })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid goal payload", 422);
      return;
    }
    const { blueprintId, goalText } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    const structured = await ValidationService.structureGoal({
      userId: auth.userId,
      blueprintId,
      input: {
        rawGoal: goalText,
        idempotencyKey: `sequence-goal:${blueprintId}:${auth.userId}`,
      },
    });
    await db.update(blueprints).set({ goal: goalText }).where(eq(blueprints.id, blueprintId));
    await SequenceTrackingService.recordGoal(blueprintId, tier, {
      goalText,
      structured: structured as unknown as Record<string, unknown>,
    });
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/sequences/purpose
router.post("/sequences/purpose", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), purposeText: z.string().min(3) })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid purpose payload", 422);
      return;
    }
    const { blueprintId, purposeText } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    await db.update(blueprints).set({ purpose: purposeText }).where(eq(blueprints.id, blueprintId));
    await SequenceTrackingService.recordPurpose(blueprintId, tier, purposeText);
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/sequences/context
router.post("/sequences/context", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bodySchema = z.object({
      blueprintId: z.string().uuid(),
      timeframe: z.number().int().positive().optional(),
      location: z.string().optional(),
      businessType: z.string().optional(),
      delivery: z.string().optional(),
      commitment: z.string().optional(),
      budget: z.number().min(0).optional(),
      limits: z.array(z.string()).optional(),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid context payload", 422);
      return;
    }
    const { blueprintId, ...context } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    await SequenceTrackingService.recordContext(blueprintId, tier, context);
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/sequences/validation-result
router.post("/sequences/validation-result", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        selectedPath: z.enum(["current", "adjusted", "alternative"]),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid validation result payload", 422);
      return;
    }
    const { blueprintId, selectedPath } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    await SequenceTrackingService.recordValidationResult(blueprintId, tier, selectedPath);
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 5B — POST /api/sequences/tier
router.post("/sequences/tier", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        tier: z.enum(["starter", "growth", "ultimate"]),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid tier payload", 422);
      return;
    }
    const { blueprintId, tier } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    await db
      .update(blueprints)
      .set({ tier, selected_blueprint_level: tier })
      .where(eq(blueprints.id, blueprintId));
    await SequenceTrackingService.recordBlueprintTier(blueprintId, tier);
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/sequences/launch-stack — policies, master plan, signals, mini plans, task gen metadata
router.post("/sequences/launch-stack", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        selectedPath: z.enum(["current", "adjusted", "alternative"]).optional(),
        goal: z.string().optional(),
        purpose: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid launch-stack payload", 422);
      return;
    }
    const { blueprintId, selectedPath, goal, purpose } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    await SequenceTrackingService.recordLaunchStack(blueprintId, tier, {
      goal,
      purpose,
      selectedPath,
    });
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 8B — sync task queue from orders
router.post("/sequences/sync-tasks", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid sync-tasks payload", 422);
      return;
    }
    const { blueprintId } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    const result = await syncTaskGenerationSequence(blueprintId, tier);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 6B — POST /api/sequences/feedback-regenerate
router.post("/sequences/feedback-regenerate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        completion: z.string().optional(),
        score: z.number().min(0).max(10).optional(),
        reflection: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid feedback-regenerate payload", 422);
      return;
    }
    const { blueprintId, completion, score, reflection } = parsed.data;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const tier = await loadTier(blueprintId);
    const result = await processFeedbackRegeneration({
      blueprintId,
      userId: auth.userId,
      tier,
      completion,
      score,
      reflection,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 34B — GET scene
router.get("/blueprints/:blueprintId/sequence/scene", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const [bp] = await db
      .select({ current_condition: blueprints.current_condition })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    const scenes = await computeSceneFromBlueprint(
      blueprintId,
      bp?.current_condition ?? "stability",
    );
    success(res, scenes);
  } catch (err) {
    handleError(req, res, err);
  }
});

// Prompt 39B — POST /api/sequences/complete-blueprint
router.post("/sequences/complete-blueprint", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        goal: z.string().min(3),
        purpose: z.string().min(3),
        timeframe: z.number().int().positive().optional(),
        tier: z.enum(["starter", "growth", "ultimate"]).optional(),
        location: z.string().optional(),
        businessType: z.string().optional(),
        validationContractId: z.string().uuid().optional(),
        selectedPath: z.enum(["current", "adjusted", "alternative"]).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid complete-blueprint payload", 422);
      return;
    }
    const result = await SequenceOrchestrationService.createCompleteBlueprint({
      userId: auth.userId,
      ...parsed.data,
    });
    success(res, result, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

// Legacy path — POST /api/blueprints/:blueprintId/sequence/context
router.post("/blueprints/:blueprintId/sequence/context", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId;
    if (!(await assertBlueprintAccess(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const schema = z.object({
      timeframe: z.number().int().positive().optional(),
      location: z.string().optional(),
      businessType: z.string().optional(),
      delivery: z.string().optional(),
      commitment: z.string().optional(),
      budget: z.number().min(0).optional(),
      limits: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid context payload", 422);
      return;
    }
    const tier = await loadTier(blueprintId);
    await SequenceTrackingService.recordContext(blueprintId, tier, parsed.data);
    success(res, await SequenceTrackingService.getStatus(blueprintId));
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
