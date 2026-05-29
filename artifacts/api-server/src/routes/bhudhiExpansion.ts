import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { expansionEngine } from "../bhudhi/expansion/expansion-engine/ExpansionEngine.js";

const router = Router();

const expansionBodySchema = z.object({
  blueprintId: z.string().uuid(),
  world: z.record(z.string(), z.unknown()).optional(),
  decisions: z.record(z.string(), z.unknown()).optional(),
  beliefs: z.record(z.string(), z.unknown()).optional(),
  experiments: z.record(z.string(), z.unknown()).optional(),
  execution: z.record(z.string(), z.unknown()).optional(),
  memory: z.record(z.string(), z.unknown()).optional(),
  results: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  seed: z.string().optional(),
  governanceApproved: z.boolean().optional(),
  capabilityId: z.string().uuid().optional(),
});

// GET /api/bhudhi/expansion/status?blueprintId=
router.get("/bhudhi/expansion/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().safeParse(req.query.blueprintId);
    if (!blueprintId.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId query required", 400);
      return;
    }

    const ok = await requireUserBlueprint(res, blueprintId.data, auth.userId);
    if (!ok) return;

    const status = await expansionEngine.getStatus(blueprintId.data);
    bhudhiSuccess(res, { success: true, status });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/discover
router.post("/bhudhi/expansion/discover", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid expansion payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const expansion = await expansionEngine.discover(parsed.data);
    bhudhiSuccess(res, {
      success: true,
      expansion,
      insight: expansion.recommendation,
      nextSteps: [
        "POST /api/bhudhi/expansion/evaluate",
        "POST /api/bhudhi/expansion/benchmark",
        "POST /api/bhudhi/expansion/promote",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/evaluate
router.post("/bhudhi/expansion/evaluate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid evaluate payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const expansion = await expansionEngine.evaluate(parsed.data);
    bhudhiSuccess(res, { success: true, expansion });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/benchmark
router.post("/bhudhi/expansion/benchmark", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid benchmark payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const benchmark = await expansionEngine.benchmark(parsed.data);
    bhudhiSuccess(res, { success: true, benchmark });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/promote
router.post("/bhudhi/expansion/promote", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid promote payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const expansion = await expansionEngine.promote({
      ...parsed.data,
      governanceApproved: parsed.data.governanceApproved ?? true,
    });
    bhudhiSuccess(res, { success: true, expansion });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/approve — human governance decision (required for promotion)
router.post("/bhudhi/expansion/approve", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema
      .extend({
        capabilityId: z.string().uuid(),
        approved: z.boolean(),
        promote: z.boolean().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId, capabilityId, approved required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await expansionEngine.approveDecision(
      {
        ...parsed.data,
        governanceApproved: parsed.data.promote === true && parsed.data.approved,
      },
      parsed.data.capabilityId,
      parsed.data.approved,
      auth.userId,
    );

    bhudhiSuccess(res, {
      success: true,
      ...result,
      insight: parsed.data.approved
        ? "Capability approved — bounded expansion only with explicit governance"
        : "Capability rejected — default posture is reject unless approved",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/rollback
router.post("/bhudhi/expansion/rollback", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema
      .extend({ capabilityId: z.string().uuid() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "capabilityId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await expansionEngine.rollbackCapability(
      parsed.data.capabilityId,
      parsed.data.blueprintId,
      auth.userId,
    );
    bhudhiSuccess(res, { ...result, success: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/reject
router.post("/bhudhi/expansion/reject", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = expansionBodySchema
      .extend({ capabilityId: z.string().uuid() })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "capabilityId and blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const result = await expansionEngine.reject(parsed.data, parsed.data.capabilityId);
    bhudhiSuccess(res, { ...result, success: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/expansion/history
router.post("/bhudhi/expansion/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const data = await expansionEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, ...data });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
