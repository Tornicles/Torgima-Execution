import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { metaGovernor } from "../bhudhi/governor/governor-engine/MetaGovernor.js";

const router = Router();

const governorBodySchema = z.object({
  blueprintId: z.string().uuid(),
  world: z.record(z.string(), z.unknown()).optional(),
  beliefs: z.record(z.string(), z.unknown()).optional(),
  decisions: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  economics: z.record(z.string(), z.unknown()).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
  organization: z.record(z.string(), z.unknown()).optional(),
  time: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  subsystems: z.array(z.string()).optional(),
});

const recoverySchema = governorBodySchema.extend({
  target: z.enum(["execution", "memory", "simulation", "identity", "organization"]),
  mode: z.enum(["soft", "adaptive", "rollback", "full"]).optional(),
});

// POST /api/bhudhi/governor/observe
router.post("/bhudhi/governor/observe", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = governorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid governor payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const governor = await metaGovernor.observe(parsed.data);

    bhudhiSuccess(res, {
      success: true,
      governor,
      insight: governor.executionPlan.note,
      topPriority: governor.priorityMap.topPriority,
      nextSteps: [
        "POST /api/bhudhi/governor/prioritize",
        "POST /api/bhudhi/governor/health",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governor/prioritize
router.post("/bhudhi/governor/prioritize", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = governorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid prioritize payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const priorityMap = await metaGovernor.prioritize(parsed.data);
    bhudhiSuccess(res, { success: true, priorityMap });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governor/allocate
router.post("/bhudhi/governor/allocate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = governorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid allocate payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const allocation = await metaGovernor.allocate(parsed.data);
    bhudhiSuccess(res, { success: true, allocation });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governor/recover
router.post("/bhudhi/governor/recover", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = recoverySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid recovery payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { target, mode, ...rest } = parsed.data;
    const recovery = await metaGovernor.recover(rest, target, mode);
    bhudhiSuccess(res, { success: true, recovery });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governor/health
router.post("/bhudhi/governor/health", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = governorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid health payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const health = await metaGovernor.health(parsed.data);
    bhudhiSuccess(res, { success: true, health });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/governor/history
router.post("/bhudhi/governor/history", async (req, res) => {
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

    const history = await metaGovernor.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
