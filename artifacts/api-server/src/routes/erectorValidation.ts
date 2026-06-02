import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { ErectorValidationUpgradeService } from "../services/ErectorValidationUpgradeService.js";
import { ValidationBridgeService } from "../engines/erector/ValidationBridgeService.js";
import { TorgimaError } from "../lib/errors.js";

const router = Router();

const ValidationRunInputSchema = z.object({
  blueprint_draft_id: z.string().uuid().optional(),
  idea_title: z.string().min(1),
  idea_description: z.string().optional(),
  goal: z.string().min(1),
  purpose: z.string().min(1),
  timeframe: z.string().min(1),
  context: z.string().optional(),
  commitment_level: z.string().optional(),
  known_blockers: z.string().optional(),
  location: z.object({ country: z.string(), city: z.string().optional() }).optional(),
  businessType: z.enum(["online", "offline", "hybrid"]).optional(),
  businessModel: z.string().optional(),
  budgetAvailable: z.number().optional(),
  currency: z.string().optional(),
  currentResources: z.array(z.string()).optional(),
  targetCustomer: z.string().optional(),
  tier: z.enum(["starter", "growth", "ultimate"]).optional(),
});

const SelectPathSchema = z.object({
  path_type: z.enum(["current", "adjusted", "alternative"]),
});

router.post("/run", async (req, res, next) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const body = ValidationRunInputSchema.parse(req.body);
    const run = await ErectorValidationUpgradeService.startRun({
      user_id: auth.userId,
      ...body,
    });
    res.json({ ok: true, data: { run_id: run.id, status: run.status } });
  } catch (err) {
    next(err);
  }
});

router.get("/:run_id/status", async (req, res, next) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const status = await ErectorValidationUpgradeService.getStatus(req.params.run_id, auth.userId);
    res.json({ ok: true, data: status });
  } catch (err) {
    next(err);
  }
});

router.get("/:run_id", async (req, res, next) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await ErectorValidationUpgradeService.getFullResults(req.params.run_id, auth.userId);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post("/:run_id/select-path", async (req, res, next) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { path_type } = SelectPathSchema.parse(req.body);
    const row = await ErectorValidationUpgradeService.selectPath(
      req.params.run_id,
      auth.userId,
      path_type,
    );
    res.json({ ok: true, data: { selected_path: row.selected_path } });
  } catch (err) {
    next(err);
  }
});

router.post("/:run_id/launch-blueprint", async (req, res, next) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const tier = (req.body as { tier?: string })?.tier;
    const result = await ValidationBridgeService.launchBlueprint({
      validation_run_id: req.params.run_id,
      user_id: auth.userId,
      tier: tier === "growth" || tier === "ultimate" ? tier : "starter",
    });
    res.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof TorgimaError) {
      res.status(err.retryable ? 503 : 400).json({
        ok: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }
    next(err);
  }
});

export default router;
