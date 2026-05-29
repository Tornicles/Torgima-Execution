import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { ErectorRefinementService } from "../services/ErectorRefinementService.js";
import {
  applySectionEdit,
  compareValidationVersions,
  finalizeValidationWorkspace,
  getValidationStage,
  getWorkspaceFromRow,
  loadWorkspace,
  selectExecutionPath,
  updateValidationWorkspace,
} from "../engines/erector/ErectorValidationWorkspace.js";
import { ERECTOR_BUSINESS_TYPES } from "../types/erector-refinement.js";
import {
  parseGoalUnderstandBody,
  parsePurposeUnderstandBody,
  refineGoalOptions,
  refinePurposeOptions,
} from "../lib/erectorRefinementRoutes.js";
import { db, blueprints } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function assertBlueprint(blueprintId: string, userId: string) {
  const [bp] = await db.select({ user_id: blueprints.user_id }).from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  return bp?.user_id === userId;
}

router.get("/v1/erector/refinement/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.params.blueprintId;
    if (!(await assertBlueprint(blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.getState(blueprintId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/goal/understand", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = parseGoalUnderstandBody(req.body);
    if (!parsed.ok) {
      failure(res, "VALIDATION_ERROR", "Invalid goal understand payload", 400, {
        fieldErrors: parsed.fieldErrors,
      });
      return;
    }
    const options = refineGoalOptions(parsed.rawGoal);
    success(res, { options });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Erector] POST /v1/erector/refinement/goal/understand error:", message);
    if (stack) console.error(stack);
    console.error(err);
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/goal/select", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), optionIndex: z.number().int().min(0).max(2) })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid goal select payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.selectGoal(parsed.data.blueprintId, auth.userId, parsed.data.optionIndex));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/goal/finalize", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid(), goalFinal: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid goal finalize payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.finalizeGoal(parsed.data.blueprintId, auth.userId, parsed.data.goalFinal));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/purpose/understand", async (req, res) => {
  try {
    await requireAuth(req, "USER_SESSION");
    const parsed = parsePurposeUnderstandBody(req.body);
    if (!parsed.ok) {
      failure(res, "VALIDATION_ERROR", "Invalid purpose understand payload", 400, {
        fieldErrors: parsed.fieldErrors,
      });
      return;
    }
    const options = refinePurposeOptions(parsed.rawPurpose, parsed.selectedGoal);
    success(res, { options });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[Erector] POST /v1/erector/refinement/purpose/understand error:", message);
    if (stack) console.error(stack);
    console.error(err);
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/purpose/select", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ blueprintId: z.string().uuid(), optionIndex: z.number().int().min(0).max(2) })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid purpose select payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.selectPurpose(parsed.data.blueprintId, auth.userId, parsed.data.optionIndex));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/purpose/finalize", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid(), purposeFinal: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid purpose finalize payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.finalizePurpose(parsed.data.blueprintId, auth.userId, parsed.data.purposeFinal));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/lock", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ blueprintId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid lock payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    success(res, await ErectorRefinementService.lockRefinement(parsed.data.blueprintId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/erector/refinement/feed", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        blueprintId: z.string().uuid(),
        goal_final: z.string().min(10),
        purpose_final: z.string().min(10),
        country: z.string().min(2),
        business_type: z.string().min(2),
        business_model: z.string().min(2),
        commitment_level: z.string().min(2),
        budget: z.number().min(0),
        resources: z.array(z.string()).default([]),
        target_customer: z.string().min(5),
        currency: z.string().optional(),
        location_city: z.string().optional(),
        timeframe: z
          .object({
            start: z.string().optional(),
            end: z.string().optional(),
            duration_days: z.number().int().positive().optional(),
          })
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid validation feed payload", 422);
      return;
    }
    if (!(await assertBlueprint(parsed.data.blueprintId, auth.userId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const { blueprintId, ...feed } = parsed.data;
    success(res, await ErectorRefinementService.saveValidationFeed(blueprintId, auth.userId, feed));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/v1/erector/business-types", (_req, res) => {
  success(res, { types: ERECTOR_BUSINESS_TYPES });
});

// Workspace — 20-section editable validation
router.get("/v1/validation/:validationId/workspace", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { row } = await loadWorkspace(req.params.validationId, auth.userId);
    success(res, {
      validationId: row.id,
      workspace: getWorkspaceFromRow(row),
      goal_final: row.goal_final,
      purpose_final: row.purpose_final,
      finalized: Boolean(row.is_finalized ?? row.validation_final),
      path_foundation: row.path_foundation,
      path_momentum: row.path_momentum,
      path_overdrive: row.path_overdrive,
      selected_execution_path: row.selected_execution_path,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/workspace/edit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        sectionId: z.string(),
        action: z.enum(["edit", "add", "remove"]),
        content: z.string().min(1),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid workspace edit", 422);
      return;
    }
    success(
      res,
      await applySectionEdit(
        req.params.validationId,
        auth.userId,
        parsed.data.sectionId as import("../types/erector-refinement.js").ValidationSectionId,
        parsed.data.action,
        parsed.data.content,
      ),
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/workspace/update", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await updateValidationWorkspace(req.params.validationId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/workspace/finalize", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await finalizeValidationWorkspace(req.params.validationId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/v1/validation/:validationId/stage/:stageName", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await getValidationStage(req.params.validationId, auth.userId, req.params.stageName));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.get("/v1/validation/:validationId/compare", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    success(res, await compareValidationVersions(req.params.validationId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ path: z.enum(["foundation", "momentum", "overdrive"]) }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "path must be foundation, momentum, or overdrive", 422);
      return;
    }
    success(res, await selectExecutionPath(req.params.validationId, auth.userId, parsed.data.path));
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/edit-stage", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({ stage_name: z.string(), field: z.string().optional(), value: z.string() })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid edit-stage payload", 422);
      return;
    }
    success(
      res,
      await applySectionEdit(
        req.params.validationId,
        auth.userId,
        parsed.data.stage_name as import("../types/erector-refinement.js").ValidationSectionId,
        "edit",
        parsed.data.value ?? parsed.data.field ?? "",
      ),
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

router.post("/v1/validation/:validationId/refresh-stage", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z.object({ stage_name: z.string() }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "stage_name required", 422);
      return;
    }
    success(res, await updateValidationWorkspace(req.params.validationId, auth.userId));
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
