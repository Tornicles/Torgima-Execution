import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../../lib/auth.js";
import { success, failure, handleError } from "../../lib/utils.js";
import { isTorgimaError } from "../../lib/errors.js";
import { selectValidationPath } from "../../services/erector/ErectorPathSelectionService.js";

const router = Router();

const selectPathSchema = z.object({
  selected_path: z.enum(["current", "adjusted", "alternative"]),
});

// POST /api/erector/validation/:validationRunId/select-path
router.post("/:validationRunId/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = selectPathSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid path selection body", 400);
      return;
    }

    const result = await selectValidationPath({
      validationRunId: req.params.validationRunId,
      userId: auth.userId,
      selectedPath: parsed.data.selected_path,
    });

    success(res, result);
  } catch (err) {
    if (isTorgimaError(err) && err.code === "VALIDATION_ERROR") {
      failure(res, err.code, err.message, 400);
      return;
    }
    handleError(req, res, err);
  }
});

export default router;
