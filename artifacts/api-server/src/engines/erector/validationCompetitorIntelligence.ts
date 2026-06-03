import {
  db,
  validationAtAGlance,
  validationCompetitors,
  validationMarketTrends,
  validationOpportunities,
  validationPaths,
  validationProsCons,
  validationRisks,
  validationRuns,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getFallback } from "../../bhudhi/FallbackLibrary.js";
import { getContract } from "../../bhudhi/PromptRegistry.js";
import { lookupResearchCache, storeResearchCache } from "../../bhudhi/bhudhiResearchCache.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { logger } from "../../lib/logger.js";
import type { ValidationRunInput } from "./ValidationResearchEngine.js";
import type {
  CompetitorArchetype,
  CompetitorDeepOutput,
  ValidationExplanations,
} from "../../types/validationExplanations.js";
import {
  buildDeterministicExplanations,
  type ExplanationContext,
} from "./validationExplanations.js";

const ARCHETYPES: CompetitorArchetype[] = ["pioneer", "fast_mover", "indie_survivor"];

const ARCHETYPE_LABEL: Record<CompetitorArchetype, string> = {
  pioneer: "The Pioneer",
  fast_mover: "The Fast-Mover",
  indie_survivor: "The Indie-Survivor",
};

const STATUS_BY_ARCHETYPE: Record<CompetitorArchetype, string> = {
  pioneer: "researching_competitor_pioneer",
  fast_mover: "researching_competitor_fast_mover",
  indie_survivor: "researching_competitor_indie_survivor",
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function normalizeDeepOutput(raw: Record<string, unknown>, archetype: CompetitorArchetype): CompetitorDeepOutput {
  const conf = (v: unknown): "verified" | "estimated" | "unavailable" => {
    const s = String(v ?? "unavailable");
    return s === "verified" || s === "estimated" ? s : "unavailable";
  };
  const rl = asRecord(raw.revenue_lifecycle) ?? {};
  const ms = asRecord(raw.marketing_strategy) ?? {};
  const gc = asRecord(raw.growth_catalyst) ?? {};
  const fpo = asRecord(raw.first_product_origin) ?? {};
  return {
    name: String(raw.name ?? ARCHETYPE_LABEL[archetype]),
    archetype: (raw.archetype as CompetitorArchetype) ?? archetype,
    description: String(raw.description ?? "Competitor profile from market research."),
    website: raw.website != null ? String(raw.website) : null,
    twitter: raw.twitter != null ? String(raw.twitter) : null,
    linkedin: raw.linkedin != null ? String(raw.linkedin) : null,
    community_hub: raw.community_hub != null ? String(raw.community_hub) : null,
    market_share_pct:
      typeof raw.market_share_pct === "number" ? raw.market_share_pct : null,
    market_share_label: raw.market_share_label != null ? String(raw.market_share_label) : null,
    relevance_summary: String(raw.relevance_summary ?? "Relevant benchmark for this market."),
    differentiation_hint: String(raw.differentiation_hint ?? "Focus on proof and niche execution."),
    strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String).slice(0, 5) : [],
    weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.map(String).slice(0, 5) : [],
    revenue_lifecycle: {
      year1_reality: rl.year1_reality != null ? String(rl.year1_reality) : null,
      inflection_point: rl.inflection_point != null ? String(rl.inflection_point) : null,
      current_scale: rl.current_scale != null ? String(rl.current_scale) : null,
      data_confidence: conf(rl.data_confidence),
      sources: Array.isArray(rl.sources) ? rl.sources.map(String) : [],
    },
    marketing_strategy: {
      primary_channel: ms.primary_channel != null ? String(ms.primary_channel) : undefined,
      positioning_angle: ms.positioning_angle != null ? String(ms.positioning_angle) : undefined,
      conversion_mechanism:
        ms.conversion_mechanism != null ? String(ms.conversion_mechanism) : undefined,
      data_confidence: conf(ms.data_confidence),
    },
    growth_catalyst: {
      distribution_hook: gc.distribution_hook != null ? String(gc.distribution_hook) : undefined,
      retention_mechanics: gc.retention_mechanics != null ? String(gc.retention_mechanics) : undefined,
      scale_trigger: gc.scale_trigger != null ? String(gc.scale_trigger) : undefined,
      data_confidence: conf(gc.data_confidence),
    },
    first_product_origin: {
      mvp_description: fpo.mvp_description != null ? String(fpo.mvp_description) : undefined,
      day1_validation_method:
        fpo.day1_validation_method != null ? String(fpo.day1_validation_method) : undefined,
      adjustment_history: Array.isArray(fpo.adjustment_history)
        ? fpo.adjustment_history.map(String)
        : [],
      time_to_first_revenue:
        fpo.time_to_first_revenue != null ? String(fpo.time_to_first_revenue) : null,
      data_confidence: conf(fpo.data_confidence),
    },
    source_urls: Array.isArray(raw.source_urls) ? raw.source_urls.map(String) : [],
  };
}

function fallbackDeepCompetitor(archetype: CompetitorArchetype, input: ValidationRunInput): CompetitorDeepOutput {
  const fb = getFallback("fallback.validation_competitor_deep", {
    archetype_label: archetype,
    goal: input.goal,
    idea_title: input.idea_title,
  }, 0);
  const data = { ...(fb?.data ?? {}), archetype } as Record<string, unknown>;
  if (!data.name) data.name = ARCHETYPE_LABEL[archetype];
  return normalizeDeepOutput(data, archetype);
}

async function invokeDeepCompetitor(
  archetype: CompetitorArchetype,
  runId: string,
  input: ValidationRunInput,
): Promise<CompetitorDeepOutput> {
  const cacheKey = `${archetype}:${input.idea_title}:${input.goal}`;
  const cached = await lookupResearchCache({
    triggerType: "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
    queryText: cacheKey,
  });
  if (cached?.resultJson && typeof cached.resultJson === "object") {
    return normalizeDeepOutput(cached.resultJson as Record<string, unknown>, archetype);
  }

  const contract = getContract("VALIDATION_COMPETITOR_DEEP_ANALYSIS");
  const facts = {
    archetype_label: archetype,
    idea_title: input.idea_title,
    goal: input.goal,
    domain: input.businessModel ?? input.businessType ?? "online",
    market_context: input.context ?? input.known_blockers ?? "",
  };

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "ValidationResearchEngine",
      triggerType: "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id,
      stateVersion: 0,
      idempotencyKey: `validation_deep_competitor:${runId}:${archetype}`,
      facts,
      webSearchEnabled: true,
    });
    if (!result.ok || !result.output?.data || typeof result.output.data !== "object") {
      return fallbackDeepCompetitor(archetype, input);
    }
    const normalized = normalizeDeepOutput(result.output.data as Record<string, unknown>, archetype);
    await storeResearchCache({
      triggerType: "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
      queryText: cacheKey,
      resultJson: normalized,
      ttlHours: 48,
    });
    return normalized;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), archetype, runId },
      "[ValidationCompetitorIntel] Deep analysis failed — fallback",
    );
    return fallbackDeepCompetitor(archetype, input);
  }
}

export async function researchCompetitorsDeep(
  runId: string,
  input: ValidationRunInput,
  onStatus?: (status: string) => Promise<void>,
): Promise<CompetitorDeepOutput[]> {
  await db.delete(validationCompetitors).where(eq(validationCompetitors.validation_run_id, runId));

  const results: CompetitorDeepOutput[] = [];
  for (let i = 0; i < ARCHETYPES.length; i++) {
    const archetype = ARCHETYPES[i]!;
    const status = STATUS_BY_ARCHETYPE[archetype];
    if (onStatus) await onStatus(status);

    await writeEvent({
      eventType: EVENT_TYPES.VALIDATION_PHASE_STARTED,
      entityType: "validation_run",
      entityId: runId,
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id,
      payload: {
        phase: `researching_competitor_${archetype}`,
        label: `Researching ${ARCHETYPE_LABEL[archetype]} competitor...`,
        run_id: runId,
      },
      idempotencyKey: `validation_phase:${runId}:${archetype}`,
    }).catch(() => null);

    const data = await invokeDeepCompetitor(archetype, runId, input);
    results.push(data);

    await db.insert(validationCompetitors).values({
      validation_run_id: runId,
      rank: i + 1,
      competitor_archetype: archetype,
      name: data.name,
      description: data.description,
      website: data.website ?? null,
      market_share_pct: data.market_share_pct,
      market_share_label: data.market_share_label,
      strengths: data.strengths,
      weaknesses: data.weaknesses,
      relevance_summary: data.relevance_summary,
      differentiation_hint: data.differentiation_hint,
      revenue_lifecycle: data.revenue_lifecycle,
      marketing_strategy: data.marketing_strategy,
      growth_catalyst: data.growth_catalyst,
      first_product_origin: data.first_product_origin,
      digital_footprint: {
        website: data.website,
        twitter: data.twitter,
        linkedin: data.linkedin,
        community_hub: data.community_hub,
        youtube: null,
      },
      source_url: data.source_urls?.[0] ?? null,
      researched_at: new Date(),
    });
  }

  return results;
}

export async function generateValidationExplanations(
  runId: string,
  input: ValidationRunInput,
  ctx: ExplanationContext,
): Promise<ValidationExplanations> {
  await writeEvent({
    eventType: EVENT_TYPES.VALIDATION_PHASE_STARTED,
    entityType: "validation_run",
    entityId: runId,
    userId: input.user_id,
    blueprintId: input.blueprint_draft_id,
    payload: { phase: "generating_explanations", label: "Writing your analysis...", run_id: runId },
    idempotencyKey: `validation_phase:${runId}:explanations`,
  }).catch(() => null);

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "ValidationResearchEngine",
      triggerType: "VALIDATION_GENERATE_EXPLANATIONS",
      userId: input.user_id,
      blueprintId: input.blueprint_draft_id,
      stateVersion: 0,
      idempotencyKey: `validation_explanations:${runId}`,
      facts: { ...ctx },
      webSearchEnabled: false,
    });
    if (result.ok && result.output?.data && typeof result.output.data === "object") {
      const data = result.output.data as ValidationExplanations;
      if (data.reality_score) {
        await db
          .update(validationRuns)
          .set({ explanation_paragraphs: data, updated_at: new Date() })
          .where(eq(validationRuns.id, runId));
        return data;
      }
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), runId },
      "[ValidationCompetitorIntel] Explanation generation failed — deterministic fallback",
    );
  }

  const fallback = buildDeterministicExplanations(ctx);
  await db
    .update(validationRuns)
    .set({ explanation_paragraphs: fallback, updated_at: new Date() })
    .where(eq(validationRuns.id, runId));
  return fallback;
}

export async function loadExplanationContext(runId: string, input: ValidationRunInput): Promise<ExplanationContext> {
  const [run] = await db.select().from(validationRuns).where(eq(validationRuns.id, runId)).limit(1);
  const competitors = await db
    .select()
    .from(validationCompetitors)
    .where(eq(validationCompetitors.validation_run_id, runId));

  const [glance] = await db
    .select()
    .from(validationAtAGlance)
    .where(eq(validationAtAGlance.validation_run_id, runId))
    .limit(1);
  const [market] = await db
    .select()
    .from(validationMarketTrends)
    .where(eq(validationMarketTrends.validation_run_id, runId))
    .limit(1);
  const prosCons = await db
    .select()
    .from(validationProsCons)
    .where(eq(validationProsCons.validation_run_id, runId));
  const opps = await db
    .select()
    .from(validationOpportunities)
    .where(eq(validationOpportunities.validation_run_id, runId));
  const risks = await db
    .select()
    .from(validationRisks)
    .where(eq(validationRisks.validation_run_id, runId));
  const paths = await db.select().from(validationPaths).where(eq(validationPaths.validation_run_id, runId));

  const recommended = paths.find((p) => p.is_recommended) ?? paths.find((p) => p.path_type === "adjusted");

  return {
    idea_title: input.idea_title,
    goal: input.goal,
    verdict: run?.verdict ?? "adjust",
    reality_score: run?.reality_score ?? 0,
    at_a_glance_json: JSON.stringify(glance ?? {}),
    trend_position: market?.trend_position ?? "Early Growth",
    growth_rate: market?.growth_rate ?? "",
    competitor_names_and_archetypes: competitors
      .map((c) => `${c.name} (${c.competitor_archetype ?? "unknown"})`)
      .join(", "),
    pros_list: prosCons.filter((p) => p.type === "pro").map((p) => p.text).join("; "),
    cons_list: prosCons.filter((p) => p.type === "con").map((p) => p.text).join("; "),
    opportunities_list: opps.slice(0, 2).map((o) => o.title).join("; "),
    risks_list: risks.slice(0, 2).map((r) => r.risk_type).join("; "),
    selected_path_type: recommended?.path_type ?? "adjusted",
    path_description: recommended?.description ?? "",
    time_to_traction: recommended?.time_to_traction ?? "",
  };
}
