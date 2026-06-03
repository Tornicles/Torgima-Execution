import {
  db,
  validationCompetitors,
  validationPaths,
  validationRuns,
} from "@workspace/db";
import { asc, eq } from "drizzle-orm";

type CompetitorRow = typeof validationCompetitors.$inferSelect;

export function mapValidationCompetitorRowForApi(row: CompetitorRow): Record<string, unknown> {
  const sharePct =
    row.market_share_pct != null && Number.isFinite(Number(row.market_share_pct))
      ? Number(row.market_share_pct)
      : null;
  const footprint = (row.digital_footprint ?? {}) as Record<string, unknown>;

  return {
    name: row.name,
    tagline: row.description?.split(".")[0]?.trim() ?? row.description ?? "",
    description: row.description ?? "",
    competitor_archetype: row.competitor_archetype,
    archetype: row.competitor_archetype,
    website: row.website,
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
    market_share_pct: sharePct,
    market_share_label: sharePct != null ? `${Math.round(sharePct)}%` : row.market_share_label ?? "",
    marketShare: sharePct != null ? `${Math.round(sharePct)}%` : "",
    relevance_summary: row.relevance_summary,
    differentiation_hint: row.differentiation_hint,
    whereYourIdeaFits: row.relevance_summary ?? row.differentiation_hint ?? "",
    revenue_lifecycle: row.revenue_lifecycle,
    revenueLifecycle: row.revenue_lifecycle,
    marketing_strategy: row.marketing_strategy,
    marketingStrategy: row.marketing_strategy,
    growth_catalyst: row.growth_catalyst,
    growthCatalyst: row.growth_catalyst,
    first_product_origin: row.first_product_origin,
    firstProductOrigin: row.first_product_origin,
    digital_footprint: footprint,
    digitalFootprint: footprint,
    founded: "—",
    estimatedRevenue: "—",
    userBase: "—",
    geography: "Global",
  };
}

export async function findValidationRunByLegacyId(
  legacyValidationId: string,
): Promise<typeof validationRuns.$inferSelect | null> {
  const [run] = await db
    .select()
    .from(validationRuns)
    .where(eq(validationRuns.legacy_validation_id, legacyValidationId))
    .limit(1);
  return run ?? null;
}

export async function loadPanelCompetitorsForLegacyValidation(
  legacyValidationId: string,
): Promise<Record<string, unknown>[]> {
  const run = await findValidationRunByLegacyId(legacyValidationId);
  if (!run) return [];

  const rows = await db
    .select()
    .from(validationCompetitors)
    .where(eq(validationCompetitors.validation_run_id, run.id))
    .orderBy(asc(validationCompetitors.rank));

  if (rows.length === 0) return [];
  return rows.map(mapValidationCompetitorRowForApi);
}

export async function loadPanelPathsForLegacyValidation(
  legacyValidationId: string,
): Promise<Record<"current" | "adjusted" | "alternative", Record<string, unknown>> | null> {
  const run = await findValidationRunByLegacyId(legacyValidationId);
  if (!run) return null;

  const rows = await db
    .select()
    .from(validationPaths)
    .where(eq(validationPaths.validation_run_id, run.id));

  if (rows.length === 0) return null;

  const out: Record<string, Record<string, unknown>> = {};
  for (const p of rows) {
    const key = p.path_type;
    if (key !== "current" && key !== "adjusted" && key !== "alternative") continue;
    out[key] = {
      label: p.label,
      description: p.description,
      summary: p.description,
      tagline: p.tagline,
      successPotential: p.success_potential,
      success_potential: p.success_potential,
      estimatedOutcome: p.estimated_outcome,
      estimated_outcome: p.estimated_outcome,
      timeToTraction: p.time_to_traction,
      time_to_traction: p.time_to_traction,
      recommended: p.is_recommended,
      keyChanges: p.key_adjustments,
      milestones: p.milestones,
    };
  }
  return out as Record<"current" | "adjusted" | "alternative", Record<string, unknown>>;
}

export async function loadExplanationParagraphsForLegacyValidation(
  legacyValidationId: string,
): Promise<Record<string, unknown> | null> {
  const run = await findValidationRunByLegacyId(legacyValidationId);
  if (!run?.explanation_paragraphs || typeof run.explanation_paragraphs !== "object") {
    return null;
  }
  return run.explanation_paragraphs as Record<string, unknown>;
}
