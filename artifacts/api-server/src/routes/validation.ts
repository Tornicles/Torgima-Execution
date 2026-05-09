import { Router } from "express";
import { ValidationService } from "../services/ValidationService.js";
import { success, handleError } from "../lib/utils.js";

const router = Router();

// POST /api/validation/run
router.post("/validation/run", async (req, res) => {
  try {
    const { rawGoal, domain } = req.body as { rawGoal: string; domain?: string };
    const result = await ValidationService.validate(rawGoal, domain ?? null);
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
