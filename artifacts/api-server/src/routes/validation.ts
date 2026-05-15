import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { ValidationService } from "../services/ValidationService.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();

const goalInputSchema = z.object({
  blueprintId: z.string().uuid(),
  goal: z.string().min(5).max(500),
  purpose: z.string().max(1000).optional(),
  timeframe: z.string().max(200).optional(),
  commitmentLevel: z.enum(["low", "medium", "high", "full"]).optional(),
  currentContext: z.string().max(1000).optional(),
  successSignal: z.string().max(500).optional(),
  knownBlockers: z.string().max(500).optional(),
  domainHint: z.string().optional(),
  tier: z.enum(["starter", "growth", "ultimate"]).optional(),
  mode: z.enum(["individual", "team"]).optional(),
});

// POST /api/validation/start
router.post("/validation/start", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;
    const session = await ValidationService.startValidation({
      blueprintId: input.blueprintId,
      userId: auth.userId,
      tier: input.tier,
      mode: input.mode,
      input: {
        goal: input.goal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext: input.currentContext,
        successSignal: input.successSignal,
        knownBlockers: input.knownBlockers,
        domainHint: input.domainHint,
      },
    });
    success(res, session);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/run — Run or re-run validation
router.post("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const input = parsed.data;
    const result = await ValidationService.validateGoal({
      blueprintId: input.blueprintId,
      userId: auth.userId,
      tier: input.tier,
      mode: input.mode,
      input: {
        goal: input.goal,
        purpose: input.purpose,
        timeframe: input.timeframe,
        commitmentLevel: input.commitmentLevel,
        currentContext: input.currentContext,
        successSignal: input.successSignal,
        knownBlockers: input.knownBlockers,
        domainHint: input.domainHint,
      },
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/run?blueprintId=...
router.get("/validation/run", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = req.query["blueprintId"] as string | undefined;
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId query parameter required", 422);
      return;
    }
    const result = await ValidationService.getValidationResult({ blueprintId, userId: auth.userId });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/status
router.get("/validation/:id/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const status = await ValidationService.getValidationStatus(req.params.id, auth.userId);
    success(res, status);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/result — by validation session id (resolves blueprint)
router.get("/validation/:id/result", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const result = await ValidationService.getValidationResult({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/:id/select-path
router.post("/validation/:id/select-path", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      selectedPath: z.enum(["current", "adjusted", "alternative"]),
      confirmAdjusted: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const out = await ValidationService.selectValidationPath({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      selectedPath: parsed.data.selectedPath,
      confirmAdjusted: parsed.data.confirmAdjusted,
    });
    success(res, out);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/validation/:id/edit-inputs — re-run via blueprint id on session
router.post("/validation/:id/edit-inputs", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = goalInputSchema.omit({ blueprintId: true }).safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const result = await ValidationService.validateGoal({
      blueprintId: row.blueprint_id,
      userId: auth.userId,
      tier: parsed.data.tier,
      mode: parsed.data.mode,
      input: {
        goal: parsed.data.goal,
        purpose: parsed.data.purpose,
        timeframe: parsed.data.timeframe,
        commitmentLevel: parsed.data.commitmentLevel,
        currentContext: parsed.data.currentContext,
        successSignal: parsed.data.successSignal,
        knownBlockers: parsed.data.knownBlockers,
        domainHint: parsed.data.domainHint,
      },
    });
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/industry-intelligence
router.get("/validation/:id/industry-intelligence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const { db, validations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(validations).where(eq(validations.id, req.params.id)).limit(1);
    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }
    const panel = await ValidationService.getIndustryIntelligence(row.blueprint_id, auth.userId);
    success(res, panel);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
