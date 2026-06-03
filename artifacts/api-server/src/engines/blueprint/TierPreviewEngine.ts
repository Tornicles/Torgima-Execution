import { db, blueprintTierPreviews, validations } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { TorgimaError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import {
  getTierConfig,
  normalizeBlueprintTier,
  TIER_PREVIEW_HEADLINES,
  type TierConfig,
} from "./TierConfig.js";

const TIERS: BlueprintTier[] = ["starter", "growth", "ultimate"];

const TIER_MULTIPLIER: Record<BlueprintTier, number> = {
  starter: 1.0,
  growth: 1.4,
  ultimate: 1.8,
};

export type TierGrowthProjection = {
  days30: string;
  days60: string;
  days90: string;
};

export type TierPreviewCard = {
  tier: BlueprintTier;
  headline: string;
  description: string;
  planCount: number;
  targetTypes: string[];
  signalSystem: string;
  taskStyle: string;
  aiDepth: string;
  highlights: string[];
  growthProjection: TierGrowthProjection;
  recommended: boolean;
  recommendationReason: string | null;
};

function normalizeScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  return score > 1 ? score / 100 : score;
}

/** Recommend tier from feasibility, clarity, and realism (0–1 normalized). */
export function recommendTier(scores: {
  feasibility_score?: number | null;
  clarity_score?: number | null;
  realism_score?: number | null;
}): BlueprintTier {
  const f = normalizeScore(scores.feasibility_score);
  const c = normalizeScore(scores.clarity_score);
  const r = normalizeScore(scores.realism_score);
  const avg = (f + c + r) / 3;
  if (avg < 0.5) return "starter";
  if (avg < 0.75) return "growth";
  return "ultimate";
}

function recommendationReason(tier: BlueprintTier, recommended: BlueprintTier, avg: number): string | null {
  if (tier !== recommended) return null;
  if (recommended === "starter") {
    return "Your validation scores suggest building structure and clarity before scaling execution depth.";
  }
  if (recommended === "growth") {
    return `Balanced scores (avg ${Math.round(avg * 100)}%) support structured execution with full signal and condition control.`;
  }
  return `Strong scores (avg ${Math.round(avg * 100)}%) support predictive optimization and strategic control.`;
}

export function computeGrowthProjection(
  avgNormalized: number,
  tier: BlueprintTier,
): TierGrowthProjection {
  const mult = TIER_MULTIPLIER[tier];
  const base = Math.min(92, Math.round(avgNormalized * 100 * mult * 0.28));
  const d30 = Math.min(99, Math.max(8, base));
  const d60 = Math.min(99, Math.round(d30 * 1.28));
  const d90 = Math.min(99, Math.round(d30 * 1.55));
  return {
    days30: `${d30}%`,
    days60: `${d60}%`,
    days90: `${d90}%`,
  };
}

function signalSystemLabel(mode: TierConfig["signal_mode"]): string {
  if (mode === "simplified") return "Simplified progress states (Starting → Improving)";
  if (mode === "full") return "Full 7-signal execution intelligence";
  return "Predictive signals with burnout and trajectory awareness";
}

function taskStyleLabel(style: TierConfig["task_style"]): string {
  if (style === "simple") return "Clear daily tasks with instruction and proof";
  if (style === "condition_controlled") return "Condition-controlled task limits and difficulty caps";
  return "Predictive sequencing with fatigue-aware workload";
}

function aiDepthLabel(depth: number): string {
  if (depth <= 1) return "Guided explanations — session memory only";
  if (depth === 2) return "Structured operational intelligence — 7-day memory";
  return "Strategic interpretation — 30-day memory and pattern detection";
}

function defaultHighlights(cfg: TierConfig): string[] {
  const items = [
    `${cfg.plans.length} execution plans`,
    cfg.seasons_enabled ? `${cfg.seasons?.length ?? 4} seasons` : "No seasons (linear focus)",
    `${cfg.target_types.length} target types`,
    signalSystemLabel(cfg.signal_mode),
    `Policy: ${cfg.policy_enforcement.replace(/_/g, " ")}`,
  ];
  return items.slice(0, 5);
}

function templateDescription(tier: BlueprintTier, cfg: TierConfig, goal: string): string {
  const goalSnippet = goal.trim() ? ` for “${goal.trim().slice(0, 80)}”` : "";
  if (tier === "starter") {
    return `${TIER_PREVIEW_HEADLINES.starter}${goalSnippet}. You get guided structure, simple signals, and daily tasks without overwhelming control layers.`;
  }
  if (tier === "growth") {
    return `${TIER_PREVIEW_HEADLINES.growth}${goalSnippet}. Full signal and condition engines adapt task volume and difficulty as you execute.`;
  }
  return `${TIER_PREVIEW_HEADLINES.ultimate}${goalSnippet}. Predictive optimization ranks actions, recalibrates targets, and enforces policy at the strategic layer.`;
}

function buildTemplateCard(
  tier: BlueprintTier,
  cfg: TierConfig,
  ctx: {
    goal: string;
    recommended: BlueprintTier;
    avg: number;
  },
): TierPreviewCard {
  const recommended = tier === ctx.recommended;
  return {
    tier,
    headline: TIER_PREVIEW_HEADLINES[tier],
    description: templateDescription(tier, cfg, ctx.goal),
    planCount: cfg.plans.length,
    targetTypes: [...cfg.target_types],
    signalSystem: signalSystemLabel(cfg.signal_mode),
    taskStyle: taskStyleLabel(cfg.task_style),
    aiDepth: aiDepthLabel(cfg.intelligence_depth),
    highlights: defaultHighlights(cfg),
    growthProjection: computeGrowthProjection(ctx.avg, tier),
    recommended,
    recommendationReason: recommendationReason(tier, ctx.recommended, ctx.avg),
  };
}

async function enrichDescriptionsWithBhudhi(
  userId: string,
  blueprintId: string,
  facts: Record<string, unknown>,
): Promise<Partial<Record<BlueprintTier, string>> | null> {
  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "TIER_PREVIEW_ENGINE",
      triggerType: "BLUEPRINT_TIER_PREVIEW",
      userId,
      blueprintId,
      stateVersion: 0,
      idempotencyKey: `tier_preview:${blueprintId}:${Date.now()}`,
      facts,
      webSearchEnabled: false,
    });
    if (!result.ok || !result.output?.data || typeof result.output.data !== "object") {
      return null;
    }
    const data = result.output.data as {
      tierDescriptions?: Partial<Record<BlueprintTier, string>>;
    };
    return data.tierDescriptions ?? null;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), blueprintId },
      "[TierPreviewEngine] Bhudhi enrichment skipped",
    );
    return null;
  }
}

export const TierPreviewEngine = {
  recommendTier,

  /**
   * Build three tier preview cards, persist to blueprint_tier_previews, update validation tier flow.
   * Skips when verdict is pivot (returns empty array).
   */
  async buildPreviews(validationId: string, userId: string): Promise<TierPreviewCard[]> {
    const [row] = await db
      .select()
      .from(validations)
      .where(and(eq(validations.id, validationId), eq(validations.user_id, userId)))
      .limit(1);

    if (!row) {
      throw new TorgimaError("NOT_FOUND", "Validation not found", false);
    }

    if (row.verdict === "pivot") {
      await db
        .update(validations)
        .set({
          tier_flow_status: "scored",
          updated_at: new Date(),
        })
        .where(eq(validations.id, validationId));
      return [];
    }

    const goal = String(row.goal_final ?? row.raw_goal ?? "").trim();
    const recommended = recommendTier(row);
    const f = normalizeScore(row.feasibility_score);
    const c = normalizeScore(row.clarity_score);
    const r = normalizeScore(row.realism_score);
    const avg = (f + c + r) / 3;

    const bhudhiDescriptions = await enrichDescriptionsWithBhudhi(userId, row.blueprint_id, {
      goal,
      purpose: row.purpose ?? row.purpose_final ?? "",
      verdict: row.verdict,
      feasibility_score: f,
      clarity_score: c,
      realism_score: r,
      recommended_tier: recommended,
    });

    const cards: TierPreviewCard[] = TIERS.map((tier) => {
      const cfg = getTierConfig(tier);
      const card = buildTemplateCard(tier, cfg, { goal, recommended, avg });
      const enriched = bhudhiDescriptions?.[tier];
      if (enriched?.trim()) {
        card.description = enriched.trim();
      }
      return card;
    });

    await db
      .delete(blueprintTierPreviews)
      .where(eq(blueprintTierPreviews.validation_id, validationId));

    const now = new Date();
    for (const card of cards) {
      await db.insert(blueprintTierPreviews).values({
        validation_id: validationId,
        user_id: userId,
        tier: card.tier,
        headline: card.headline,
        description: card.description,
        plan_count: card.planCount,
        target_types: card.targetTypes,
        signal_system: card.signalSystem,
        task_style: card.taskStyle,
        ai_depth: card.aiDepth,
        highlights: card.highlights,
        growth_projection: card.growthProjection,
        recommended: card.recommended,
        recommendation_reason: card.recommendationReason,
        selected: false,
        created_at: now,
      });
    }

    await db
      .update(validations)
      .set({
        tier_flow_status: "tier_presented",
        tier_presented_at: now,
        tier_preview_data: cards as unknown as Record<string, unknown>,
        selected_blueprint_tier: row.selected_blueprint_tier ?? recommended,
        updated_at: now,
      })
      .where(eq(validations.id, validationId));

    return cards;
  },

  async listPreviews(validationId: string, userId: string): Promise<TierPreviewCard[]> {
    const rows = await db
      .select()
      .from(blueprintTierPreviews)
      .where(
        and(
          eq(blueprintTierPreviews.validation_id, validationId),
          eq(blueprintTierPreviews.user_id, userId),
        ),
      );

    return rows.map((r) => ({
      tier: normalizeBlueprintTier(r.tier),
      headline: r.headline,
      description: r.description,
      planCount: r.plan_count,
      targetTypes: r.target_types ?? [],
      signalSystem: r.signal_system,
      taskStyle: r.task_style,
      aiDepth: r.ai_depth,
      highlights: Array.isArray(r.highlights) ? (r.highlights as string[]) : [],
      growthProjection: (r.growth_projection as TierGrowthProjection) ?? {
        days30: "—",
        days60: "—",
        days90: "—",
      },
      recommended: r.recommended,
      recommendationReason: r.recommendation_reason,
    }));
  },
};
