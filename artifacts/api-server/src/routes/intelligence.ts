import { Router } from "express";
import { db, blueprints } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure } from "../lib/utils.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { assessCapabilityLevel } from "../engines/capability/CapabilityEngine.js";
import { getActivePatterns } from "../engines/pattern/PatternLearningEngine.js";
import { RealityIntelligenceEngine } from "../engines/intelligence/RealityIntelligenceEngine.js";

const router = Router();

router.get("/intelligence/blueprint/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const id = req.params.id!;
    const [bp] = await db
      .select({
        id: blueprints.id,
        goal: blueprints.goal,
        purpose: blueprints.purpose,
        current_domain: blueprints.current_domain,
        intel_metadata: blueprints.intel_metadata,
      })
      .from(blueprints)
      .where(and(eq(blueprints.id, id), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    const meta = bp.intel_metadata as { realityIntelligence?: unknown } | null;
    const cached = meta?.realityIntelligence;
    if (cached && typeof cached === "object") {
      success(res, cached);
      return;
    }

    const fresh = await RealityIntelligenceEngine.analyze({
      goal: bp.goal,
      domain: bp.current_domain ?? "genesis",
      purpose: bp.purpose ?? "",
      blueprintId: id,
      userId: auth.userId,
    });

    success(res, fresh);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to load intelligence", 500);
  }
});

router.get("/capability", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const assessment = await assessCapabilityLevel(auth.userId);
    success(res, assessment);
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get capability", 500);
  }
});

router.get("/patterns", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const [blueprint] = await db
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(and(eq(blueprints.user_id, auth.userId), eq(blueprints.active, true)))
      .limit(1);

    if (!blueprint) {
      success(res, { patterns: [] });
      return;
    }

    const patterns = await getActivePatterns(auth.userId, blueprint.id);
    success(res, {
      patterns: patterns.map(p => {
        const spec = (p.evidence_json as { spec_label?: string })?.spec_label ?? p.pattern_type;
        return {
          id:          p.id,
          patternType: spec,
          severity:    p.severity,
          confidence:  p.confidence,
          frequency:   p.frequency,
          detectedAt:  p.first_detected_at,
        };
      }),
    });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    failure(res, "INTERNAL_ERROR", "Failed to get patterns", 500);
  }
});

export default router;
