/**
 * Phase 8 — intelligence API routes (auth + ownership).
 */

import { Router } from "express";
import { db, blueprints, decisionTraces, outcomeValidations, rewardEvents } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { getActivePatterns } from "../engines/pattern/PatternLearningEngine.js";
import { getOpenFlags } from "../engines/outcome/OutcomeValidationEngine.js";
import { getCurrentIdentityState, getIdentityHistory } from "../engines/identity/IdentityContinuityEngine.js";
import { getRecentRewards } from "../engines/identity/RewardEngine.js";

const router = Router();

async function assertBlueprintOwner(userId: string, blueprintId: string) {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  return bp ?? null;
}

router.get("/v1/intelligence/patterns/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.blueprintId ?? "");
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const patterns = await getActivePatterns(auth.userId, blueprintId);
    success(res, {
      patterns: patterns.map((p) => {
        const evidence = (p.evidence_json ?? {}) as Record<string, unknown>;
        return {
          id: p.id,
          patternType: String(evidence.spec_label ?? p.pattern_type),
          severity: p.severity,
          confidence: p.confidence,
          frequency: p.frequency,
          status: p.status,
          firstDetectedAt: p.first_detected_at,
          evidence,
        };
      }),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

router.get("/v1/intelligence/decisions/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.blueprintId ?? "");
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const traces = await db
      .select()
      .from(decisionTraces)
      .where(eq(decisionTraces.blueprint_id, blueprintId))
      .orderBy(desc(decisionTraces.created_at))
      .limit(20);

    success(res, {
      decisions: traces.map((t) => ({
        id: t.id,
        decisionType: t.decision_type,
        engine: t.engine_source ?? t.engine,
        reasoning: t.reasoning,
        inputSummary: t.input_summary,
        outputSummary: t.output_summary,
        stateVersion: t.state_version,
        createdAt: t.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/v1/intelligence/outcomes/:blueprintId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.blueprintId ?? "");
    if (!(await assertBlueprintOwner(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const [validations, flags] = await Promise.all([
      db
        .select()
        .from(outcomeValidations)
        .where(eq(outcomeValidations.blueprint_id, blueprintId))
        .orderBy(desc(outcomeValidations.created_at))
        .limit(20),
      getOpenFlags(blueprintId),
    ]);

    success(res, {
      validations: validations.map((v) => ({
        id: v.id,
        targetId: v.target_id,
        validationResult: v.validation_result,
        verdict: v.verdict,
        alignmentScore: v.alignment_score,
        createdAt: v.created_at,
      })),
      falseProgressFlags: flags.map((f) => ({
        id: f.id,
        pattern: f.detection_type,
        status: f.status,
        severity: f.severity,
        createdAt: f.created_at,
      })),
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/v1/intelligence/identity/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = String(req.params.userId ?? "");
    if (userId !== auth.userId) {
      failure(res, "FORBIDDEN", "Cannot read another user's identity", 403);
      return;
    }

    const [bp] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
      .limit(1);

    const blueprintId = bp?.id;
    const state = blueprintId
      ? await getCurrentIdentityState(userId, blueprintId)
      : null;
    const history = blueprintId ? await getIdentityHistory(userId, blueprintId) : [];

    success(res, { state, history });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

router.get("/v1/intelligence/rewards/:userId", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const userId = String(req.params.userId ?? "");
    if (userId !== auth.userId) {
      failure(res, "FORBIDDEN", "Cannot read another user's rewards", 403);
      return;
    }

    const blueprintId =
      typeof req.query.blueprintId === "string" ? req.query.blueprintId : undefined;
    if (blueprintId && !(await assertBlueprintOwner(userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const rewards = await getRecentRewards(userId, blueprintId);
    const rows = await db
      .select()
      .from(rewardEvents)
      .where(eq(rewardEvents.user_id, userId))
      .orderBy(desc(rewardEvents.created_at))
      .limit(30);

    success(res, {
      rewards: rewards.length > 0 ? rewards : rows,
    });
  } catch (e) {
    handleRouteError(req, res, e);
  }
});

export default router;
