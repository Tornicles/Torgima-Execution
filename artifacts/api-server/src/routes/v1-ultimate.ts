import { Router } from "express";
import { z } from "zod/v4";
import { blueprints, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { requireUltimateAccess } from "../engines/ultimate/ultimateGate.js";
import { PredictionEngine } from "../engines/ultimate/PredictionEngine.js";
import { SceneEngine } from "../engines/ultimate/SceneEngine.js";
import { ContinuousValidation } from "../engines/ultimate/ContinuousValidation.js";
import { EmergencyOrderSystem } from "../engines/ultimate/EmergencyOrderSystem.js";
import { UltimateIntelligenceService } from "../engines/ultimate/UltimateIntelligenceService.js";

const router = Router();

async function activeBlueprintForUser(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    return row?.user_id === userId ? row : null;
  }
  const [row] = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/ultimate/predictions
router.get("/v1/ultimate/predictions", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const accuracy = await PredictionEngine.getPredictionAccuracy(bp.id);
    success(res, accuracy);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/ultimate/predictions
router.post("/v1/ultimate/predictions", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        action: z.enum(["generate", "validate"]),
        blueprintId: z.string().uuid().optional(),
        predictionId: z.string().uuid().optional(),
        actual: z
          .object({
            actual_task: z.string(),
            actual_blockers: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid predictions payload", 422);
      return;
    }

    const bp = await activeBlueprintForUser(auth.userId, parsed.data.blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);

    if (parsed.data.action === "generate") {
      const history = await PredictionEngine.buildHistoryFromOrders(bp.id);
      const pred = await PredictionEngine.predictNextTask(bp.id, history);
      const recorded = await PredictionEngine.recordPrediction(bp.id, pred);
      success(res, recorded);
      return;
    }

    if (!parsed.data.predictionId || !parsed.data.actual) {
      failure(res, "VALIDATION_ERROR", "predictionId and actual required for validate", 422);
      return;
    }

    const validated = await PredictionEngine.validatePrediction(parsed.data.predictionId, {
      actual_task: parsed.data.actual.actual_task,
      actual_blockers: parsed.data.actual.actual_blockers ?? [],
    });
    success(res, validated);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/ultimate/scene
router.get("/v1/ultimate/scene", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const scene = await SceneEngine.getLatestScene(bp.id);
    success(res, scene);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/ultimate/scene
router.post("/v1/ultimate/scene", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.body?.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const scene = await SceneEngine.createScene(bp.id);
    success(res, scene);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/ultimate/validation
router.get("/v1/ultimate/validation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const checkpoints = await ContinuousValidation.getRecentCheckpoints(bp.id);
    success(res, { checkpoints });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/ultimate/validation
router.post("/v1/ultimate/validation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.body?.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const result = await ContinuousValidation.validate(bp.id);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/ultimate/emergency
router.get("/v1/ultimate/emergency", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const pending = await EmergencyOrderSystem.getPendingOrders(bp.id);
    success(res, { orders: pending });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/ultimate/emergency/complete
router.post("/v1/ultimate/emergency/complete", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        emergencyOrderId: z.string().uuid(),
        effectiveness: z.number().min(0).max(1).optional(),
        dismiss: z.boolean().optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid emergency payload", 422);
      return;
    }
    const bp = await activeBlueprintForUser(auth.userId, parsed.data.blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);

    const result = parsed.data.dismiss
      ? await EmergencyOrderSystem.dismissEmergencyOrder(parsed.data.emergencyOrderId)
      : await EmergencyOrderSystem.completeEmergencyOrder(
          parsed.data.emergencyOrderId,
          parsed.data.effectiveness ?? 0.75,
        );
    success(res, { order: result });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/ultimate/summary
router.get("/v1/ultimate/summary", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireUltimateAccess(bp.id);
    const summary = await UltimateIntelligenceService.getDashboardSummary(bp.id);
    success(res, summary);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
