import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { failure, handleError } from "../lib/utils.js";
import { bhudhiSuccess } from "../bhudhi/api/bhudhiApiEnvelope.js";
import { requireUserBlueprint } from "../bhudhi/api/bhudhiRouteHelpers.js";
import { infrastructureEngine } from "../bhudhi/infrastructure/infrastructure-engine/InfrastructureEngine.js";

const router = Router();

const infraBodySchema = z.object({
  blueprintId: z.string().uuid(),
  execution: z.record(z.string(), z.unknown()).optional(),
  economics: z.record(z.string(), z.unknown()).optional(),
  traffic: z.record(z.string(), z.unknown()).optional(),
  security: z.record(z.string(), z.unknown()).optional(),
  world: z.record(z.string(), z.unknown()).optional(),
  governor: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string()).optional(),
  runtimePreference: z.enum(["local", "container", "cloud", "edge", "hybrid"]).optional(),
  tenancyMode: z.enum(["single", "multi", "isolated", "enterprise"]).optional(),
});

const deploySchema = infraBodySchema.extend({
  strategy: z.enum(["blue", "green", "rolling", "canary", "shadow"]).optional(),
});

const recoverSchema = infraBodySchema.extend({
  target: z.enum(["runtime", "deployment", "storage", "network"]),
});

// POST /api/bhudhi/infra/observe
router.post("/bhudhi/infra/observe", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = infraBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid infrastructure payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const infrastructure = await infrastructureEngine.observe(parsed.data);

    bhudhiSuccess(res, {
      success: true,
      infrastructure,
      insight: infrastructure.deploymentPlan.recommendation,
      nextSteps: [
        "POST /api/bhudhi/infra/runtime",
        "POST /api/bhudhi/infra/scale",
      ],
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/infra/runtime
router.post("/bhudhi/infra/runtime", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = infraBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid runtime payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const runtime = await infrastructureEngine.runtime(parsed.data);
    bhudhiSuccess(res, { success: true, runtime });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/infra/deploy
router.post("/bhudhi/infra/deploy", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = deploySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid deploy payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { strategy, ...rest } = parsed.data;
    const deploymentPlan = await infrastructureEngine.deploy(rest, strategy);
    bhudhiSuccess(res, { success: true, deploymentPlan });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/infra/scale
router.post("/bhudhi/infra/scale", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = infraBodySchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid scale payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const scale = await infrastructureEngine.scale(parsed.data);
    bhudhiSuccess(res, { success: true, scale });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/infra/recover
router.post("/bhudhi/infra/recover", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = recoverSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid recover payload", 422);
      return;
    }

    const ok = await requireUserBlueprint(res, parsed.data.blueprintId, auth.userId);
    if (!ok) return;

    const { target, ...rest } = parsed.data;
    const recovery = await infrastructureEngine.recover(rest, target);
    bhudhiSuccess(res, { success: true, recovery });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/bhudhi/infra/history
router.post("/bhudhi/infra/history", async (req, res) => {
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

    const history = await infrastructureEngine.history(parsed.data.blueprintId, parsed.data.limit);
    bhudhiSuccess(res, { success: true, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
