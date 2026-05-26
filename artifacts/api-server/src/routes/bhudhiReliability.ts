import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { reliabilityEngine } from "../bhudhi/reliability/reliability-engine/ReliabilityEngine.js";

const router = Router();

const reliabilityBodySchema = z.object({
  blueprintId: z.string().uuid(),
  execution: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  decision: z.record(z.string(), z.unknown()).optional(),
  economics: z.record(z.string(), z.unknown()).optional(),
  memory: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  simulation: z.record(z.string(), z.unknown()).optional(),
  governance: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  chaosMode: z.enum(["SAFE", "LAB", "STAGING", "DISABLED"]).optional(),
  governanceApproved: z.boolean().optional(),
});

const rollbackSchema = reliabilityBodySchema.extend({
  target: z.enum(["memory", "state", "execution", "configuration", "deployment"]),
  mode: z.enum(["SOFT", "HARD", "PARTIAL", "SNAPSHOT"]).optional(),
});

// POST /api/bhudhi/reliability/check
router.post("/bhudhi/reliability/check", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = reliabilityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid reliability payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const reliability = await reliabilityEngine.check(parsed.data);

    bhudhiSuccess(res, {
      success: true,
      reliability,
      insight: reliability.recommendedProtection,
      resilienceScore: reliability.resilienceScore,
      nextSteps: [
        "POST /api/bhudhi/reliability/health",
        "POST /api/bhudhi/reliability/incident",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/reliability/recover
router.post("/bhudhi/reliability/recover", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = reliabilityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid recovery payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const recovery = await reliabilityEngine.recover(parsed.data);
    bhudhiSuccess(res, { success: true, recovery });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/reliability/rollback
router.post("/bhudhi/reliability/rollback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = rollbackSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid rollback payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { target, mode, ...rest } = parsed.data;
    const rollback = await reliabilityEngine.rollback(rest, target, mode);
    bhudhiSuccess(res, { success: true, rollback });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/reliability/incident
router.post("/bhudhi/reliability/incident", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = reliabilityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid incident payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const incident = await reliabilityEngine.incident(parsed.data);
    bhudhiSuccess(res, { success: true, incident });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/reliability/health
router.post("/bhudhi/reliability/health", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = reliabilityBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid health payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const health = await reliabilityEngine.health(parsed.data);
    bhudhiSuccess(res, { success: true, health });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/reliability/history
router.post("/bhudhi/reliability/history", async (req, res) => {
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

    const history = await reliabilityEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
