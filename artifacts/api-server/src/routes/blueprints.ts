import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { BlueprintService } from "../services/BlueprintService.js";
import { ValidationService } from "../services/ValidationService.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/blueprints
router.get("/blueprints", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprints = await BlueprintService.list(auth.userId);
    success(res, blueprints);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints
router.post("/blueprints", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      goal:            z.string().min(1).max(2000).optional(),
      rawGoal:         z.string().min(1).max(2000).optional(),
      purpose:         z.string().max(500).optional().nullable(),
      timeframeDays:   z.number().int().min(7).max(730).optional().nullable(),
      domainHint:      z.string().optional().nullable(),
      domain:          z.string().optional().nullable(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprint input", 422);
      return;
    }

    const body = parsed.data;
    const goal = body.goal ?? body.rawGoal;
    if (!goal) {
      failure(res, "VALIDATION_ERROR", "goal is required", 422);
      return;
    }

    const result = await BlueprintService.create(auth.userId, {
      goal,
      purpose:         body.purpose ?? null,
      timeframeDays:   body.timeframeDays ?? null,
      domainHint:      body.domainHint ?? body.domain ?? null,
      commitmentLevel: body.commitmentLevel ?? null,
    });

    success(res, result, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/history
router.get("/blueprints/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const history = await BlueprintService.getHistory(auth.userId);
    success(res, history);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id
router.get("/blueprints/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprint = await BlueprintService.get(req.params.id!, auth.userId);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/activate — Prompt 5: accepts optional selectedPath
router.post("/blueprints/:id/activate", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      selectedPath: z.enum(["current", "adjusted", "alternative"]).optional(),
    });

    const body = schema.safeParse(req.body).data ?? {};

    // If a path was selected, store it on the validation record first
    if (body.selectedPath) {
      await ValidationService.selectValidationPath({
        blueprintId:  req.params.id!,
        userId:       auth.userId,
        selectedPath: body.selectedPath,
      }).catch(() => null); // Non-fatal — blueprint may not have a validation record
    }

    const result = await BlueprintService.activate(req.params.id!, auth.userId);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/state
router.get("/blueprints/:id/state", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const state = await BlueprintService.getBlueprintState(req.params.id!, auth.userId);
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/pause
router.post("/blueprints/:id/pause", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({ reason: z.string().min(1).max(1000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "reason is required", 422);
      return;
    }

    const blueprint = await BlueprintService.pause(req.params.id!, auth.userId, parsed.data.reason);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/blueprints/:id/resume
router.post("/blueprints/:id/resume", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprint = await BlueprintService.resume(req.params.id!, auth.userId);
    success(res, blueprint);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
