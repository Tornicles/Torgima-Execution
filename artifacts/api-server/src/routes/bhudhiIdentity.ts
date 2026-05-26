import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { identityEngine } from "../bhudhi/identity/identity-engine/IdentityEngine.js";

const router = Router();

const identityBodySchema = z.object({
  blueprintId: z.string().uuid(),
  trigger: z.string().optional(),
  memory: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  signals: z.record(z.string(), z.unknown()).optional(),
  blueprint: z.record(z.string(), z.unknown()).optional(),
  life: z.record(z.string(), z.unknown()).optional(),
  beliefs: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  feedback: z.record(z.string(), z.unknown()).optional(),
  history: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/bhudhi/identity/profile
router.post("/bhudhi/identity/profile", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = identityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid identity payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const identity = await identityEngine.process({
      ...parsed.data,
      userId: auth.userId,
    });

    bhudhiSuccess(res, {
      success: true,
      identity,
      insight: `Profile: ${identity.identityState.executionProfile} — ${identity.growthDirection.currentState}`,
      confidence: identity.capabilities.capabilityScore,
      nextSteps: ["POST /api/bhudhi/identity/growth", "POST /api/bhudhi/identity/adapt"],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/identity/growth
router.post("/bhudhi/identity/growth", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const growth = await identityEngine.growth(parsed.data.blueprintId);
    bhudhiSuccess(res, { success: true, growth });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/identity/adapt
router.post("/bhudhi/identity/adapt", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = identityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid adapt payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const adaptations = await identityEngine.adapt(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, adaptations });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/identity/values
router.post("/bhudhi/identity/values", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = identityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid values payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const values = await identityEngine.values(parsed.data.blueprintId);
    bhudhiSuccess(res, { success: true, values });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/identity/history
router.post("/bhudhi/identity/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), limit: z.number().int().min(1).max(50).optional() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const history = await identityEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/identity/drift
router.post("/bhudhi/identity/drift", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = identityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid drift payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const drift = await identityEngine.driftCheck(parsed.data.blueprintId, parsed.data);
    bhudhiSuccess(res, { success: true, drift });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
