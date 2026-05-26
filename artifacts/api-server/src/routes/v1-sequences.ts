import { Router } from "express";
import { z } from "zod/v4";
import { blueprints, db } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { SequenceTracker } from "../engines/sequence/SequenceTracker.js";

const router = Router();

async function activeBlueprintForUser(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({ id: blueprints.id, user_id: blueprints.user_id })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    return row?.user_id === userId ? row : null;
  }
  const [row] = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/sequences/status?blueprintId=
router.get("/v1/sequences/status", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    const status = await SequenceTracker.getSequenceStatus(bp.id);
    success(res, status);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/sequences/advance
router.post("/v1/sequences/advance", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        reason: z.string().optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid advance payload", 422);
      return;
    }
    const bp = await activeBlueprintForUser(auth.userId, parsed.data.blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    const result = await SequenceTracker.advanceSequence(
      bp.id,
      parsed.data.reason ?? "Manual advance",
    );
    success(res, result);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/sequences/audit?blueprintId=
router.get("/v1/sequences/audit", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    const audit = await SequenceTracker.getAuditTrail(bp.id);
    success(res, audit);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
