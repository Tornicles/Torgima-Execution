/**
 * DOC B4b — Authenticated Erector intake session routes.
 */
import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../../lib/auth.js";
import { success, failure, handleError } from "../../lib/utils.js";
import { isTorgimaError } from "../../lib/errors.js";
import {
  completeIntakeSession,
  createIntakeSession,
  getIntakeSessionForUser,
  saveIntakeSection,
  serializeIntakeSession,
} from "../../services/erector/intake-service.js";
import {
  finishErectorApiLog,
  readIdempotencyKey,
  withApiIdempotency,
} from "../../lib/erectorApiHelpers.js";

const router = Router();

const createSessionSchema = z.object({
  tier: z.enum(["pro", "authenticated"]).default("authenticated"),
  handoff_token: z.string().trim().min(8).max(128).optional(),
});

const patchSessionSchema = z.object({
  section: z.number().int().min(1).max(8),
  data: z.record(z.string(), z.unknown()),
});

// POST /api/erector/intake/session
router.post("/intake/session", async (req, res) => {
  try {
    const started = Date.now();
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = createSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid intake session body", 400);
      return;
    }

    const idempotencyKey = readIdempotencyKey(req);
    const outcome = await withApiIdempotency("intake_session_create", idempotencyKey, async () => {
      const session = await createIntakeSession(
        auth.userId,
        parsed.data.tier,
        parsed.data.handoff_token,
      );
      return {
        status: 201,
        body: {
          ok: true as const,
          data: serializeIntakeSession(session),
          erector_state: "INTAKE_STARTED",
          message: "Intake session created.",
        },
      };
    });

    res.status(outcome.cached ? 200 : outcome.status).json(outcome.body);

    await finishErectorApiLog({
      runType: "erector_api_intake_session",
      req,
      userId: auth.userId,
      startedAt: started,
      statusCode: outcome.cached ? 200 : outcome.status,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/erector/intake/session/:id
router.get("/intake/session/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const session = await getIntakeSessionForUser(req.params.id, auth.userId);
    if (!session) {
      failure(res, "NOT_FOUND", "Intake session not found", 404);
      return;
    }
    success(res, serializeIntakeSession(session));
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/erector/intake/session/:id/section
router.patch("/intake/session/:id/section", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = patchSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section payload", 400, {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      });
      return;
    }
    const session = await saveIntakeSection(
      req.params.id,
      auth.userId,
      parsed.data.section,
      parsed.data.data,
    );
    success(res, serializeIntakeSession(session));
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/erector/intake/session/:id (legacy alias)
router.patch("/intake/session/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = patchSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid section payload", 400, {
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      });
      return;
    }
    const session = await saveIntakeSection(
      req.params.id,
      auth.userId,
      parsed.data.section,
      parsed.data.data,
    );
    success(res, serializeIntakeSession(session));
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/erector/intake/session/:id/complete
router.post("/intake/session/:id/complete", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const result = await completeIntakeSession(req.params.id, auth.userId);
    if (!result.validation_ready) {
      success(res, result, 422);
      return;
    }
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
