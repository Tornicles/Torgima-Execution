/**
 * DOC 29 — Complete API Routes Specification (Phase 1 canonical paths).
 * Thin handlers: auth, ownership, envelope — delegate to engines/services.
 */

import { Router } from "express";
import { z } from "zod/v4";
import { randomUUID } from "node:crypto";
import {
  db,
  blueprints,
  blueprintVersions,
  cognitiveLoadScores,
  decisionTraces,
  failureClassifications,
  feedback,
  orderDependencies,
  orders,
  rewardEvents,
  validations,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { handleRouteError } from "../lib/route-helpers.js";
import { isTorgimaError, torgimaErrorToStatus } from "../lib/errors.js";
import { getCurrentStateVersion } from "../services/StateMutationService.js";
import { getActivePatterns } from "../engines/pattern/PatternLearningEngine.js";
import { detectFriction } from "../engines/friction/FrictionDetectionEngine.js";
import { getCurrentIdentityState, getIdentityHistory } from "../engines/identity/IdentityContinuityEngine.js";
import { OrderService } from "../services/OrderService.js";
import { checkExecutability } from "../engines/dependency/DependencyMappingEngine.js";
import { generateUploadUrl } from "../engines/chat/PersonalChatEngine.js";
import { processFeedbackClarification } from "../engines/feedback/submitFeedbackPhase1.js";
import { ERECTOR_ARCHETYPE_SEEDS } from "../engines/erector/archetypeData.js";

const router = Router();

const PROOF_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
]);

async function activeBlueprint(userId: string) {
  const [bp] = await db
    .select({
      id: blueprints.id,
      state_version: blueprints.state_version,
      current_domain: blueprints.current_domain,
    })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return bp ?? null;
}

async function ownedBlueprint(userId: string, blueprintId: string) {
  const [bp] = await db
    .select({ id: blueprints.id, state_version: blueprints.state_version })
    .from(blueprints)
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
    .limit(1);
  return bp ?? null;
}

// GET /api/state/current — lightweight sync pointer (DOC 29 §10)
router.get("/state/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, {
        stateVersion: 0,
        blueprintId: null,
        condition: null,
        pendingSync: false,
      });
      return;
    }
    success(res, {
      stateVersion: bp.state_version ?? 0,
      blueprintId: bp.id,
      condition: null,
      pendingSync: false,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/cognitive-load/current (DOC 29 §10)
router.get("/cognitive-load/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { loadScore: 0, band: "low", simplificationRecommended: false });
      return;
    }
    const [row] = await db
      .select({
        load_score: cognitiveLoadScores.load_score,
        created_at: cognitiveLoadScores.created_at,
      })
      .from(cognitiveLoadScores)
      .where(
        and(
          eq(cognitiveLoadScores.user_id, auth.userId),
          eq(cognitiveLoadScores.blueprint_id, bp.id),
        ),
      )
      .orderBy(desc(cognitiveLoadScores.created_at))
      .limit(1);

    const loadScore = row?.load_score ?? 0;
    const band = loadScore >= 0.7 ? "high" : loadScore >= 0.4 ? "medium" : "low";
    success(res, {
      loadScore,
      band,
      simplificationRecommended: loadScore >= 0.6,
      measuredAt: row?.created_at ?? null,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/patterns/current (DOC 29 §12)
router.get("/patterns/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { patterns: [] });
      return;
    }
    const patterns = await getActivePatterns(auth.userId, bp.id);
    success(res, {
      patterns: patterns.map((p) => ({
        id: p.id,
        patternType: p.pattern_type,
        severity: p.severity,
        confidence: p.confidence,
        status: p.status,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/friction/current (DOC 29 §12)
router.get("/friction/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { frictionType: null, severity: "LOW", adaptationNeeded: false });
      return;
    }
    const state = await detectFriction({ userId: auth.userId, blueprintId: bp.id });
    success(res, state);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/failures/current (DOC 29 §12)
router.get("/failures/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { classifications: [] });
      return;
    }
    const orderRows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.blueprint_id, bp.id))
      .limit(200);
    const orderIds = orderRows.map((o) => o.id);
    if (orderIds.length === 0) {
      success(res, { classifications: [] });
      return;
    }
    const rows = await db
      .select()
      .from(failureClassifications)
      .where(
        and(
          eq(failureClassifications.user_id, auth.userId),
          inArray(failureClassifications.order_id, orderIds),
        ),
      )
      .orderBy(desc(failureClassifications.created_at))
      .limit(10);

    success(res, {
      classifications: rows.map((r) => ({
        id: r.id,
        orderId: r.order_id,
        primaryCandidate: r.primary_candidate,
        primaryLikelihood: r.primary_likelihood,
        systemAction: r.system_action,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/priority/current (DOC 29 §12)
router.get("/priority/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const task = await OrderService.getPrimaryDashboardTask(auth.userId);
    if (!task) {
      success(res, { currentTask: null, reason: "no_active_order" });
      return;
    }
    success(res, {
      currentTask: {
        orderId: task.orderId,
        title: task.title,
        priority: task.priority,
        priorityEngine: task.priorityEngine ?? null,
      },
      reason: task.priorityEngine ?? "priority_engine",
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/dependencies/current (DOC 29 §12)
router.get("/dependencies/current", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { blockers: [], executable: true });
      return;
    }
    const task = await OrderService.getPrimaryDashboardTask(auth.userId);
    if (!task?.orderId) {
      success(res, { blockers: [], executable: true });
      return;
    }
    const exec = await checkExecutability({
      blueprintId: bp.id,
      userId: auth.userId,
      orderId: task.orderId,
    });
    const deps = await db
      .select()
      .from(orderDependencies)
      .where(eq(orderDependencies.blueprint_id, bp.id))
      .limit(50);

    success(res, {
      executable: exec.executable,
      blockingDependencies: exec.blockingDependencies,
      recommendedNextAction: exec.recommendedNextAction,
      dependencyCount: deps.length,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/decisions/history (DOC 29 §12)
router.get("/decisions/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { decisions: [] });
      return;
    }
    const traces = await db
      .select()
      .from(decisionTraces)
      .where(eq(decisionTraces.blueprint_id, bp.id))
      .orderBy(desc(decisionTraces.created_at))
      .limit(30);

    success(res, {
      decisions: traces.map((t) => ({
        id: t.id,
        decisionType: t.decision_type,
        engine: t.engine_source ?? t.engine,
        reasoning: t.reasoning,
        stateVersion: t.state_version,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/identity/history (DOC 29 §8)
router.get("/identity/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const bp = await activeBlueprint(auth.userId);
    if (!bp) {
      success(res, { history: [] });
      return;
    }
    const history = await getIdentityHistory(auth.userId, bp.id);
    const state = await getCurrentIdentityState(auth.userId, bp.id);
    success(res, { state, history });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/rewards/history (DOC 29 §8)
router.get("/rewards/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const rows = await db
      .select()
      .from(rewardEvents)
      .where(eq(rewardEvents.user_id, auth.userId))
      .orderBy(desc(rewardEvents.created_at))
      .limit(30);

    success(res, {
      rewards: rows.map((r) => ({
        id: r.id,
        rewardType: r.reward_type,
        title: r.title,
        description: r.description,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/blueprints/:id/versions (DOC 29 §9)
router.get("/blueprints/:id/versions", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.id ?? "");
    if (!(await ownedBlueprint(auth.userId, blueprintId))) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }
    const versions = await db
      .select({
        id: blueprintVersions.id,
        versionNumber: blueprintVersions.version_number,
        changeType: blueprintVersions.change_type,
        affectedLayer: blueprintVersions.affected_layer,
        frameworkSource: blueprintVersions.framework_source,
        triggeredBy: blueprintVersions.triggered_by,
        createdAt: blueprintVersions.created_at,
      })
      .from(blueprintVersions)
      .where(eq(blueprintVersions.blueprint_id, blueprintId))
      .orderBy(desc(blueprintVersions.version_number))
      .limit(50);

    const stateVersion = await getCurrentStateVersion(blueprintId);
    success(res, { stateVersion, versions });
  } catch (err) {
    handleError(req, res, err);
  }
});

const blueprintPatchSchema = z
  .object({
    projectName: z.string().min(3).max(50).optional(),
    project_name: z.string().min(3).max(50).optional(),
    tier: z.enum(["starter", "growth", "ultimate"]).optional(),
    mode: z.enum(["individual", "team"]).optional(),
    expectedStateVersion: z.number().int().min(0).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

// PATCH /api/blueprints/:id — controlled field updates (DOC 29 §9)
router.patch("/blueprints/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = String(req.params.id ?? "");
    const parsed = blueprintPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid blueprint patch body", 422);
      return;
    }

    const [bp] = await db
      .select({
        id: blueprints.id,
        state_version: blueprints.state_version,
        project_name: blueprints.project_name,
      })
      .from(blueprints)
      .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, auth.userId)))
      .limit(1);

    if (!bp) {
      failure(res, "NOT_FOUND", "Blueprint not found", 404);
      return;
    }

    if (
      parsed.data.expectedStateVersion !== undefined &&
      parsed.data.expectedStateVersion !== bp.state_version
    ) {
      failure(res, "STALE_STATE", "Blueprint state version mismatch", 409, {
        detail: JSON.stringify({ currentStateVersion: bp.state_version }),
        retryable: true,
      });
      return;
    }

    const updates: Record<string, unknown> = {};
    const projectName = parsed.data.projectName ?? parsed.data.project_name;
    if (projectName) updates.project_name = projectName;
    if (parsed.data.tier) updates.tier = parsed.data.tier;
    if (parsed.data.mode) updates.mode = parsed.data.mode;

    if (Object.keys(updates).length === 0) {
      failure(res, "VALIDATION_ERROR", "No supported fields to update", 422);
      return;
    }

    const [updated] = await db
      .update(blueprints)
      .set(updates)
      .where(eq(blueprints.id, blueprintId))
      .returning({
        id: blueprints.id,
        project_name: blueprints.project_name,
        tier: blueprints.tier,
        mode: blueprints.mode,
        state_version: blueprints.state_version,
      });

    success(res, { blueprint: updated });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id — ownership-checked validation summary (DOC 29 §8; full panel: /result)
router.get("/validation/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const validationId = String(req.params.id ?? "");
    const [row] = await db
      .select({
        id: validations.id,
        user_id: validations.user_id,
        status: validations.status,
        verdict: validations.verdict,
        reality_score: validations.reality_score,
        validation_stage: validations.validation_stage,
        blueprint_id: validations.blueprint_id,
        launch_blocked: validations.launch_blocked,
      })
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);

    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }

    success(res, {
      validationId: row.id,
      status: row.status,
      verdict: row.verdict,
      realityScore: row.reality_score,
      validationStage: row.validation_stage,
      blueprintId: row.blueprint_id,
      launchBlocked: row.launch_blocked ?? false,
      resultPath: `/api/validation/${row.id}/result`,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/validation/:id/archetypes (DOC 29 §8)
router.get("/validation/:id/archetypes", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const validationId = String(req.params.id ?? "");
    const [row] = await db
      .select({
        archetype_resolution: validations.archetype_resolution,
        location_country: validations.location_country,
        user_id: validations.user_id,
      })
      .from(validations)
      .where(eq(validations.id, validationId))
      .limit(1);

    if (!row || row.user_id !== auth.userId) {
      failure(res, "NOT_FOUND", "Validation not found", 404);
      return;
    }

    success(res, {
      archetypeResolution: row.archetype_resolution ?? null,
      locationCountry: row.location_country ?? null,
      catalog: ERECTOR_ARCHETYPE_SEEDS,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/feedback/:id (DOC 29 §11)
router.get("/feedback/:id", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const feedbackId = String(req.params.id ?? "");
    const [row] = await db
      .select()
      .from(feedback)
      .where(and(eq(feedback.id, feedbackId), eq(feedback.user_id, auth.userId)))
      .limit(1);

    if (!row) {
      failure(res, "NOT_FOUND", "Feedback not found", 404);
      return;
    }

    success(res, {
      id: row.id,
      orderId: row.order_id,
      blueprintId: row.blueprint_id,
      completionStatus: row.completion_status,
      score: row.score,
      reflection: row.reflection,
      createdAt: row.created_at,
      interrogation: row.interrogation_json,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

const clarifyBodySchema = z
  .object({
    answer: z.string().min(5).max(5000).optional(),
    clarification_text: z.string().min(30).max(5000).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .refine(
    (data) =>
      (data.clarification_text?.trim().length ?? 0) >= 30 ||
      (data.answer?.trim().length ?? 0) >= 5,
    { message: "clarification_text (30+) or answer (5+) required" },
  );

// POST /api/feedback/:id/clarify — DOC 10 clarification re-evaluation (DOC 29 alias)
router.post("/feedback/:id/clarify", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const feedbackId = String(req.params.id ?? "");
    const parsed = clarifyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid clarify body", 422);
      return;
    }
    const clarificationText = parsed.data.clarification_text ?? parsed.data.answer ?? "";
    const result = await processFeedbackClarification(
      auth.userId,
      feedbackId,
      clarificationText,
    );
    success(res, { ...result, clarified: true });
  } catch (e) {
    if (isTorgimaError(e)) {
      failure(res, e.code, e.message, torgimaErrorToStatus(e.code));
      return;
    }
    handleRouteError(req, res, e);
  }
});

const proofUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().min(1).max(10_000_000),
  blueprintId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});

// POST /api/uploads/proof (DOC 29 §11)
router.post("/uploads/proof", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = proofUploadSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid proof upload metadata", 422);
      return;
    }
    if (!PROOF_MIME.has(parsed.data.mimeType.toLowerCase())) {
      failure(res, "VALIDATION_ERROR", "Unsupported file type", 422);
      return;
    }
    if (parsed.data.blueprintId) {
      const owned = await ownedBlueprint(auth.userId, parsed.data.blueprintId);
      if (!owned) {
        failure(res, "FORBIDDEN", "Blueprint not owned by user", 403);
        return;
      }
    }
    const fileId = randomUUID();
    const uploadUrl = generateUploadUrl(auth.userId, "file");
    success(res, {
      fileId,
      uploadUrl,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      expiresInSeconds: 3600,
    }, 201);
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
