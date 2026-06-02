import { Router } from "express";
import { z } from "zod/v4";
import { db, blueprints, targets } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import {
  getCurrentIdentityState,
  getIdentityPanelData,
  getIdentityHistory,
} from "../engines/identity/IdentityContinuityEngine.js";
import { getRecentRewards, computeStreaks } from "../engines/identity/RewardEngine.js";
import {
  validateOutcome,
  recordRealOutcome,
} from "../engines/outcome/OutcomeValidationEngine.js";
import { writeEvent, EVENT_TYPES } from "../services/EventService.js";

const router = Router();

async function assertBlueprintOwner(userId: string, blueprintId: string) {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  return bp ?? null;
}

// GET /api/v1/identity/current?blueprintId=
router.get("/v1/identity/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId || !z.string().uuid().safeParse(blueprintId).success) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const panel = await getIdentityPanelData(auth.userId, blueprintId);
    const state = await getCurrentIdentityState(auth.userId, blueprintId);
    const streaks = await computeStreaks(auth.userId, blueprintId);
    success(res, { panel, state, streaks });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

// GET /api/v1/identity/history?blueprintId=
router.get("/v1/identity/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : "";
    if (!blueprintId) {
      failure(res, "VALIDATION_ERROR", "blueprintId required", 422);
      return;
    }
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const history = await getIdentityHistory(auth.userId, blueprintId);
    success(res, { history });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

// GET /api/v1/rewards/recent?blueprintId=
router.get("/v1/rewards/recent", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    if (blueprintId && !(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const rewards = await getRecentRewards(auth.userId, blueprintId);
    success(res, { rewards });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

const defineOutcomeSchema = z.object({
  blueprintId: z.string().uuid(),
  targetId: z.string().uuid(),
  metricName: z.string().min(1).max(120),
  targetValue: z.number(),
  unit: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
});

// POST /api/v1/outcomes/define
router.post("/v1/outcomes/define", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = defineOutcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid outcome definition", 422);
      return;
    }
    const input = parsed.data;
    if (!(await assertBlueprintOwner(auth.userId, input.blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const [updated] = await db
      .update(targets)
      .set({
        metric_name: input.metricName,
        target_value: input.targetValue,
        unit: input.unit ?? null,
        description: input.description ?? undefined,
        status: "active",
      })
      .where(
        and(
          eq(targets.id, input.targetId),
          eq(targets.blueprint_id, input.blueprintId),
        ),
      )
      .returning({ id: targets.id });

    if (!updated) {
      failure(res, "NOT_FOUND", "Target not found", 404);
      return;
    }

    await writeEvent({
      eventType: EVENT_TYPES.OUTCOME_VALIDATION_REQUESTED,
      entityType: "target",
      entityId: input.targetId,
      userId: auth.userId,
      blueprintId: input.blueprintId,
      payload: { trigger: "outcome_defined", target_id: input.targetId },
      idempotencyKey: `outcome_validation:define:${input.targetId}`,
    }).catch(() => null);

    success(res, { targetId: updated.id, defined: true });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

const evidenceSchema = z.object({
  evidenceText: z.string().min(10).max(4000),
  claimText: z.string().max(500).optional(),
  targetId: z.string().uuid().optional(),
  blueprintId: z.string().uuid().optional(),
});

// POST /api/v1/outcomes/:id/evidence
router.post("/v1/outcomes/:id/evidence", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const outcomeId = String(req.params.id);
    const parsed = evidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid evidence payload", 422);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    const blueprintId = parsed.data.blueprintId ?? bp?.id;
    if (!blueprintId) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }

    await recordRealOutcome({
      userId: auth.userId,
      blueprintId,
      targetId: parsed.data.targetId,
      outcomeType: "user_evidence",
      claimedValue: parsed.data.claimText ?? "progress claim",
      evidenceText: parsed.data.evidenceText,
    });

    const result = await validateOutcome({
      userId: auth.userId,
      blueprintId,
      targetId: parsed.data.targetId,
      claimText: parsed.data.claimText,
      evidenceText: parsed.data.evidenceText,
      sourceType: "USER_EVIDENCE",
      sourceId: outcomeId,
    });

    success(res, result);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

export default router;
