import { Router } from "express";
import { z } from "zod/v4";
import { blueprints, db, feedback } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { requireGrowthAccess } from "../engines/growth/growthGate.js";
import { InterrogationService } from "../engines/growth/InterrogationService.js";
import { KnowledgeService } from "../engines/growth/KnowledgeService.js";
import { AdaptationEngine } from "../engines/growth/AdaptationEngine.js";
import { PatternLearningService } from "../engines/growth/PatternLearningService.js";
import type { FeedbackSentiment } from "../types/growth.js";

const router = Router();

async function activeBlueprintForUser(userId: string, blueprintId?: string) {
  if (blueprintId) {
    const [row] = await db
      .select({
        id: blueprints.id,
        user_id: blueprints.user_id,
        tier: blueprints.tier,
        selected_blueprint_level: blueprints.selected_blueprint_level,
        current_sequence_number: blueprints.current_sequence_number,
      })
      .from(blueprints)
      .where(eq(blueprints.id, blueprintId))
      .limit(1);
    return row?.user_id === userId ? row : null;
  }
  const [row] = await db
    .select({
      id: blueprints.id,
      user_id: blueprints.user_id,
      tier: blueprints.tier,
      selected_blueprint_level: blueprints.selected_blueprint_level,
      current_sequence_number: blueprints.current_sequence_number,
    })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return row ?? null;
}

function sentimentFromRows(
  rows: Array<{ score?: number | null; weighted_score?: number | null }>,
): FeedbackSentiment {
  if (!rows.length) return "neutral";
  const score = rows[0].score ?? rows[0].weighted_score ?? 5;
  if (score < 5) return "negative";
  if (score >= 8) return "positive";
  return "neutral";
}

// POST /api/v1/growth/interrogation
router.post("/v1/growth/interrogation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        action: z.enum(["generate", "answer"]),
        blueprintId: z.string().uuid().optional(),
        interrogationId: z.string().uuid().optional(),
        answer: z.string().min(3).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid interrogation payload", 422);
      return;
    }

    const bp = await activeBlueprintForUser(auth.userId, parsed.data.blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);

    if (parsed.data.action === "generate") {
      const recentFeedback = await db
        .select()
        .from(feedback)
        .where(eq(feedback.blueprint_id, bp.id))
        .orderBy(desc(feedback.created_at))
        .limit(5);

      const q = InterrogationService.generateQuestion(bp.id, {
        recent_feedback: recentFeedback,
        current_sequence: bp.current_sequence_number ?? 24,
        pattern_suspected: "",
        feedback_sentiment: sentimentFromRows(recentFeedback),
      });

      const log = await InterrogationService.recordQuestion(bp.id, q.question, q.category, q.context);
      success(res, { interrogation_id: log.id, ...q });
      return;
    }

    if (!parsed.data.interrogationId || !parsed.data.answer) {
      failure(res, "VALIDATION_ERROR", "interrogationId and answer required", 422);
      return;
    }

    const updated = await InterrogationService.recordAnswer(
      parsed.data.interrogationId,
      parsed.data.answer,
    );
    success(res, { success: true, insight: updated.insight_extracted, log: updated });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/growth/interrogation?blueprintId=
router.get("/v1/growth/interrogation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);
    const history = await InterrogationService.getHistory(bp.id);
    success(res, { history });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/growth/knowledge?blueprintId=&keywords=
router.get("/v1/growth/knowledge", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const keywordsRaw = z.string().optional().parse(req.query.keywords);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    const row = await requireGrowthAccess(bp.id);

    const tier = bp.tier ?? bp.selected_blueprint_level ?? "growth";
    await KnowledgeService.seedKnowledgeCards(bp.id, tier);

    const keywords = keywordsRaw ? keywordsRaw.split(",").map((k) => k.trim()) : [];
    const cards = keywords.length
      ? await KnowledgeService.getRelevantCards(
          bp.id,
          row.current_sequence_number ?? 24,
          keywords,
        )
      : await KnowledgeService.getAllCards(bp.id);

    success(res, { cards });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/growth/knowledge/:cardId/view|helpful
router.post("/v1/growth/knowledge/:cardId/:action", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const cardId = z.string().uuid().parse(req.params.cardId);
    const action = z.enum(["view", "helpful"]).parse(req.params.action);
    const blueprintId = z.string().uuid().optional().parse(req.body?.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);

    if (action === "view") await KnowledgeService.markViewed(cardId);
    else await KnowledgeService.markHelpful(cardId);

    success(res, { ok: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/growth/adaptation?blueprintId=
router.get("/v1/growth/adaptation", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);

    const pending = await AdaptationEngine.getPendingSuggestions(bp.id);
    const all = await AdaptationEngine.getAllSuggestions(bp.id);
    success(res, { pending, all });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/v1/growth/adaptation/apply
router.post("/v1/growth/adaptation/apply", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = z
      .object({
        suggestionId: z.string().uuid(),
        effectiveness: z.number().min(0).max(1).optional(),
        blueprintId: z.string().uuid().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid adaptation apply payload", 422);
      return;
    }
    const bp = await activeBlueprintForUser(auth.userId, parsed.data.blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);

    const updated = await AdaptationEngine.recordApplication(
      parsed.data.suggestionId,
      parsed.data.effectiveness ?? 0.7,
    );
    success(res, { suggestion: updated });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/v1/growth/patterns?blueprintId=
router.get("/v1/growth/patterns", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const blueprintId = z.string().uuid().optional().parse(req.query.blueprintId);
    const bp = await activeBlueprintForUser(auth.userId, blueprintId);
    if (!bp) {
      failure(res, "NOT_FOUND", "No active blueprint", 404);
      return;
    }
    await requireGrowthAccess(bp.id);

    const recent = await db
      .select()
      .from(feedback)
      .where(eq(feedback.blueprint_id, bp.id))
      .orderBy(desc(feedback.created_at))
      .limit(10);

    await PatternLearningService.detectAndStore(bp.id, recent);
    const patterns = await PatternLearningService.getPatterns(bp.id);
    success(res, { patterns });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
