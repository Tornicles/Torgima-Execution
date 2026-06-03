import {
  db,
  validationCompetitors,
  validationRuns,
  validations,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { mapValidationCompetitorRowForApi } from "../../lib/loadValidationPanels.js";
import {
  generateValidationExplanations,
  loadExplanationContext,
  researchCompetitorsDeep,
} from "./validationCompetitorIntelligence.js";
import type { ValidationRunInput } from "./ValidationResearchEngine.js";
import { buildValidationPathsViaBhudhi } from "./validationPathsBhudhi.js";

export type PostErectorEnrichmentParams = {
  validationId: string;
  userId: string;
  blueprintId: string;
  ideaTitle: string;
  goal: string;
  purpose: string;
  timeframe: string;
  context?: string;
  commitmentLevel?: string;
  businessModel?: string;
  businessType?: string;
  location?: { country: string; city?: string };
};

function toRunInput(params: PostErectorEnrichmentParams): ValidationRunInput {
  return {
    user_id: params.userId,
    blueprint_draft_id: params.blueprintId,
    idea_title: params.ideaTitle,
    goal: params.goal,
    purpose: params.purpose,
    timeframe: params.timeframe,
    context: params.context,
    commitment_level: params.commitmentLevel,
    businessModel: params.businessModel,
    businessType: params.businessType as "online" | "offline" | "hybrid" | undefined,
    location: params.location,
  };
}

async function ensureValidationRun(params: PostErectorEnrichmentParams): Promise<string> {
  const [existing] = await db
    .select({ id: validationRuns.id })
    .from(validationRuns)
    .where(eq(validationRuns.legacy_validation_id, params.validationId))
    .limit(1);

  if (existing?.id) return existing.id;

  const [row] = await db
    .select()
    .from(validations)
    .where(eq(validations.id, params.validationId))
    .limit(1);
  if (!row) throw new Error("Validation row missing for enrichment");

  const [run] = await db
    .insert(validationRuns)
    .values({
      user_id: params.userId,
      blueprint_draft_id: params.blueprintId,
      legacy_validation_id: params.validationId,
      idea_title: params.ideaTitle,
      idea_description: row.raw_goal?.slice(0, 500) ?? null,
      goal: params.goal,
      purpose: params.purpose,
      timeframe: params.timeframe,
      context: params.context ?? row.current_context,
      commitment_level: params.commitmentLevel ?? row.commitment_level,
      status: "running_reality_check",
      verdict: row.verdict,
      reality_score:
        row.reality_score != null ? Math.round(Number(row.reality_score)) : null,
    })
    .returning({ id: validationRuns.id });

  if (!run) throw new Error("Failed to create validation run for enrichment");
  return run.id;
}

async function syncCompetitorsToValidationRow(
  validationId: string,
  runId: string,
): Promise<void> {
  const competitors = await db
    .select()
    .from(validationCompetitors)
    .where(eq(validationCompetitors.validation_run_id, runId));

  if (competitors.length === 0) return;

  const mapped = competitors.map(mapValidationCompetitorRowForApi);

  await db
    .update(validations)
    .set({
      enriched_competitors: mapped,
      competitor_analysis: { competitors: mapped },
      updated_at: new Date(),
    })
    .where(eq(validations.id, validationId));
}

async function syncPathsToValidationRow(
  validationId: string,
  paths: {
    current: Record<string, unknown>;
    adjusted: Record<string, unknown>;
    alternative: Record<string, unknown>;
  },
): Promise<void> {
  await db
    .update(validations)
    .set({
      path_current: paths.current,
      path_adjusted: paths.adjusted,
      path_alternative: paths.alternative,
      updated_at: new Date(),
    })
    .where(eq(validations.id, validationId));
}

/** Bhudhi-backed panels after legacy Erector validation completes. */
export async function enrichValidationAfterErector(
  params: PostErectorEnrichmentParams,
): Promise<void> {
  try {
    const runId = await ensureValidationRun(params);
    const runInput = toRunInput(params);

    await researchCompetitorsDeep(runId, runInput);
    await syncCompetitorsToValidationRow(params.validationId, runId);

    const paths = await buildValidationPathsViaBhudhi(runId, params.validationId, runInput);
    await syncPathsToValidationRow(params.validationId, paths);

    const explanationCtx = await loadExplanationContext(runId, runInput);
    await generateValidationExplanations(runId, runInput, explanationCtx);

    await db
      .update(validationRuns)
      .set({ status: "complete", research_completed_at: new Date(), updated_at: new Date() })
      .where(eq(validationRuns.id, runId));

    logger.info(
      { validationId: params.validationId, runId },
      "[PostErectorEnrichment] Panels enriched",
    );
  } catch (err) {
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        validationId: params.validationId,
      },
      "[PostErectorEnrichment] Failed",
    );
  }
}
