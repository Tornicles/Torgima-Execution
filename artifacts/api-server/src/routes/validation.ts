import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();

// POST /api/validation/run — Run or re-run validation for an existing blueprint
router.post("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const schema = z.object({
      blueprintId:     z.string().uuid(),
      goal:            z.string().min(5).max(500),
      purpose:         z.string().max(1000).optional(),
      timeframe:       z.string().max(200).optional(),
      commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
      currentContext:  z.string().max(1000).optional(),
      successSignal:   z.string().max(500).optional(),
      knownBlockers:   z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const input = parsed.data;
    const result = await ValidationService.validateGoal({
      blueprintId: input.blueprintId,
      userId:      auth.userId,
      input:       {
        goal:            input.goal,
        purpose:         input.purpose,
        timeframe:       input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext:  input.currentContext,
        successSignal:   input.successSignal,
        knownBlockers:   input.knownBlockers,
      },
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/run?blueprintId=... — Get stored validation result
router.get("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");

    const blueprintId = req.query["blueprintId"] as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId query parameter required", 422);
      return;
    }

    const result = await ValidationService.getValidationResult({
      blueprintId,
      userId: auth.userId,
    });

    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
