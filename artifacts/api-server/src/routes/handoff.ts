/**
 * DOC B4c — Handoff token API routes.
 */
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { isTorgimaError } from "../lib/errors.js";
import {
  consumeHandoffToken,
  createHandoffToken,
  type HandoffSourceTier,
  type HandoffTargetTier,
} from "../services/handoff-service.js";

const router = Router();

const createBodySchema = z.object({
  source_tier: z.enum(["free", "pro"]),
  target_tier: z.enum(["pro", "torgima"]),
  source_validation_id: z.string().uuid(),
});

const consumeBodySchema = z.object({
  token: z.string().trim().min(8).max(128),
});

// POST /api/handoff/create — auth optional for free source
router.post("/create", async (req, res) => {
  try {
    const parsed = createBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid handoff create body", 400);
      return;
    }

    const auth = await requireAuth(req, "OPTIONAL_SESSION");
    const userId = auth.userId || undefined;

    if (parsed.data.source_tier === "pro" && !userId) {
      failure(res, "UNAUTHENTICATED", "Sign in required for Pro handoff", 401);
      return;
    }

    const result = await createHandoffToken(
      parsed.data.source_tier as HandoffSourceTier,
      parsed.data.target_tier as HandoffTargetTier,
      parsed.data.source_validation_id,
      userId,
    );

    success(res, {
      handoff_token: result.token,
      expires_at: result.expires_at,
      handoff_id: result.handoff_id,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/handoff/consume — auth required
router.post("/consume", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = consumeBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid handoff token", 400);
      return;
    }

    const result = await consumeHandoffToken(parsed.data.token, auth.userId);
    success(res, result);
  } catch (err) {
    if (isTorgimaError(err) && err.message === "HANDOFF_TOKEN_INVALID_OR_EXPIRED") {
      failure(res, "VALIDATION_ERROR", err.message, 400);
      return;
    }
    handleError(req, res, err);
  }
});

export default router;
