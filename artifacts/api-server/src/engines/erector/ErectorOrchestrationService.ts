import { db, validations, validationArchetypeMaps } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { writeEvent } from "../../services/EventService.js";
import { EventTypes } from "../../types/eventContracts.js";
import { validatePayload } from "../../lib/validationPayloadSchemas.js";
import type { ErectorValidationInput, ErectorValidationResult } from "../../types/erector.js";
import { resolveArchetype } from "./ArchetypeResolutionEngine.js";
import { calculateAllScores } from "./ScoringEngine.js";
import { buildErectorOutputs, ensureEconomicArchetypesSeeded } from "./ErectorIntelligenceBridge.js";
import { buildTimeSimulations, generatePaths } from "./PathEngine.js";
import { ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { emitArchetypeResolved } from "./emitErectorEvents.js";
import { rowToErectorResult } from "./ErectorOrchestrationHelpers.js";
import { transitionBlueprintToPathSelection } from "../../lib/transitionBlueprintToPathSelection.js";
import { resolveDefaultSelectedPath } from "../../lib/validationPathSelection.js";
import { populateWorkspaceAfterRun } from "./ErectorValidationWorkspace.js";
import { resolveValidationTimeframeFields } from "../../lib/validationTimeframe.js";
import { extractEnrichedFromOutputs } from "../../lib/enrichedValidationIntel.js";
import { logger } from "../../lib/logger.js";
import { enrichValidationAfterErector } from "./postErectorValidationEnrichment.js";

function normalizeErectorInput(input: ErectorValidationInput): ErectorValidationInput {
  const country = input.location.country;
  const goal = input.goalFinal ?? input.rawGoal;
  const purpose = input.purposeFinal ?? input.purpose;
  return {
    ...input,
    rawGoal: goal,
    purpose,
    targetCustomer: input.targetCustomer || goal,
    currentContext: input.currentContext || `Building ${input.businessModel} in ${country}`,
    budgetAvailable: input.budgetAvailable || 0,
    desiredOutcome: input.desiredOutcome || purpose,
    currentResources: input.currentResources?.length ? input.currentResources : [],
  };
}

export async function runErectorValidation(input: ErectorValidationInput): Promise<ErectorValidationResult> {
  input = normalizeErectorInput(input);
  await ensureEconomicArchetypesSeeded();

  const [existing] = await db
    .select()
    .from(validations)
    .where(eq(validations.idempotency_key, input.idempotencyKey))
    .limit(1)
    .catch(() => [] as Array<typeof validations.$inferSelect>);
  if (existing?.validation_stage === ValidationStatus.COMPLETE) return rowToErectorResult(existing);

  const timeframeFields = resolveValidationTimeframeFields({
    timeframe: input.timeframe,
    customTimeframeDays: input.customTimeframeDays,
  });

  const [created] = existing
    ? await db.update(validations).set({ validation_kind: ValidationKind.ERECTOR, payload_version: 1, validation_stage: ValidationStatus.RUNNING, status: ValidationStatus.RUNNING }).where(eq(validations.id, existing.id)).returning()
    : await db
        .insert(validations)
        .values({
          blueprint_id: input.blueprintId,
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          validation_kind: ValidationKind.ERECTOR,
          payload_version: 1,
          status: ValidationStatus.RUNNING,
          validation_stage: ValidationStatus.RUNNING,
          tier: input.tier ?? null,
          raw_goal: input.rawGoal,
          goal_final: input.goalFinal ?? null,
          purpose_final: input.purposeFinal ?? null,
          purpose: input.purpose,
          timeframe: timeframeFields.timeframe,
          timeframe_days: timeframeFields.timeframe_days,
          current_context: input.currentContext ?? null,
          location_context: input.location.country,
          location_country: input.location.country,
          location_city: input.location.city,
          domain: input.domainHint ?? null,
          success_signal: input.successSignal ?? null,
          business_type: input.businessType,
          business_model: input.businessModel,
          budget_available: input.budgetAvailable,
          currency: input.currency,
          current_resources: input.currentResources,
          target_customer: input.targetCustomer,
          desired_outcome: input.desiredOutcome,
          known_blockers: input.knownBlockers ?? [],
          commitment_level: input.commitmentLevel,
        })
        .returning();

  if (!created) throw new Error("Could not create Erector validation");

  const [countAfterCreate] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(validations)
    .catch(() => [{ count: -1 }]);
  logger.info(
    { validationId: created.id, countAfterCreate: countAfterCreate?.count },
    "[VALIDATION RUN] Created validation and confirmed DB write",
  );

  await writeEvent({
    eventType: EventTypes.ERECTOR_VALIDATION_STARTED,
    entityType: "validation",
    entityId: created.id,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: { validationId: created.id },
    idempotencyKey: `erector_validation_started:${created.id}`,
  }).catch(() => null);

  const archetypeResolution = await resolveArchetype(input.location.country, input.location.city);
  await db.update(validations).set({ archetype_resolution: archetypeResolution, validation_stage: "archetype_resolved" }).where(eq(validations.id, created.id));
  await emitArchetypeResolved({
    validationId: created.id,
    blueprintId: input.blueprintId,
    userId: input.userId,
    archetypeResolution,
  });
  const persistedArchetypeMaps = [archetypeResolution.primaryArchetype, ...archetypeResolution.secondaryArchetypes]
    .filter((item) => !item.id.startsWith("seed-"))
    .map((item, index) => ({ validation_id: created.id, archetype_id: item.id, is_primary: index === 0 }));
  if (persistedArchetypeMaps.length > 0) {
    await db.insert(validationArchetypeMaps).values(persistedArchetypeMaps).catch(() => null);
  }

  const outputs = await buildErectorOutputs(input, archetypeResolution, created.id);
  const scores = calculateAllScores({
    input,
    archetypeResolution,
    marketAnalysis: outputs.marketAnalysis,
    competitorAnalysis: outputs.competitorAnalysis,
    timingAnalysis: outputs.timingAnalysis,
  });
  const simulations = await buildTimeSimulations(input, archetypeResolution, scores, created.id);
  const paths = await generatePaths(input, archetypeResolution, scores, simulations, created.id);
  const erectorPayload = {
    archetype: archetypeResolution,
    purpose: outputs.purposeDecomposition,
    industry: outputs.industryIntelligence,
    market: outputs.marketAnalysis,
    competitors: outputs.competitorAnalysis,
    economy: outputs.economyBriefing,
    pain: outputs.customerPainAnalysis,
    difficulty: outputs.executionDifficulty,
    simulations,
    paths,
    scores,
  };
  const enriched = extractEnrichedFromOutputs(outputs, input, archetypeResolution);
  const intelligencePayload = {
    erector: true,
    archetypeResolution,
    scores,
    economyBriefing: outputs.economyBriefing,
    competitors: enriched.competitors,
    opportunities: enriched.opportunities,
    economicContext: enriched.economicContext,
    bhudhiTriggerCount: outputs.bhudhiTriggerCount,
    bhudhiFallbackCount: outputs.bhudhiFallbackCount,
    systemsProgress: { ERECTOR: "complete" },
  };
  const payloadCheck = validatePayload(ValidationKind.ERECTOR, intelligencePayload);
  if (!payloadCheck.success) {
    throw new Error(`Erector payload failed schema check: ${payloadCheck.error.message}`);
  }

  const enrichedDbPatch = {
    economic_context: enriched.economicContext,
    enriched_competitors: enriched.competitors,
    enriched_opportunities: enriched.opportunities,
  };

  const [complete] = await db
    .update(validations)
    .set({
      purpose_decomposition: outputs.purposeDecomposition,
      industry_intelligence: outputs.industryIntelligence,
      market_analysis: outputs.marketAnalysis,
      competitor_analysis: outputs.competitorAnalysis,
      economy_briefing: outputs.economyBriefing,
      customer_pain_analysis: outputs.customerPainAnalysis,
      timing_analysis: outputs.timingAnalysis,
      execution_difficulty: outputs.executionDifficulty,
      time_simulations: simulations,
      market_score: scores.marketScore,
      execution_score: scores.executionScore,
      timing_score: scores.timingScore,
      competition_score: scores.competitionScore,
      scalability_score: scores.scalabilityScore,
      local_economy_score: scores.localEconomyScore,
      resource_score: scores.resourceScore,
      blueprint_difficulty_score: scores.blueprintDifficultyScore,
      risk_score: scores.riskScore,
      momentum_potential: scores.momentumPotential,
      trust_building_score: scores.trustBuildingScore,
      reality_score: scores.realityScore,
      path_current: paths.current,
      path_adjusted: paths.adjusted,
      path_alternative: paths.alternative,
      industry_pros: archetypeResolution.economySpecificOpportunities,
      industry_cons: archetypeResolution.economySpecificWarnings,
      winner_analysis: outputs.competitorAnalysis,
      recommended_blueprint_level: scores.recommendedBlueprintLevel,
      verdict: scores.verdict,
      launch_blocked: scores.verdict === "pivot" || scores.verdict === "blocked",
      readiness:
        scores.verdict === "proceed"
          ? "ready_proceed"
          : scores.verdict === "adjust"
            ? "ready_with_adjustment"
            : scores.verdict === "blocked"
              ? "blocked_reality"
              : "blocked_pivot",
      validation_stage: "complete",
      erector_validation_stage: ErectorValidationStage.COMPLETE,
      status: ValidationStatus.COMPLETE,
      validation_kind: ValidationKind.ERECTOR,
      payload_version: 1,
      erector_payload: erectorPayload,
      intelligence_payload: intelligencePayload,
      ...enrichedDbPatch,
    } as never)
    .where(eq(validations.id, created.id))
    .returning();

  await writeEvent({
    eventType: EventTypes.ERECTOR_VALIDATION_COMPLETED,
    entityType: "validation",
    entityId: created.id,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: {
      validationId: created.id,
      contract_id: created.contract_id,
      realityScore: scores.realityScore,
      verdict: scores.verdict,
    },
    idempotencyKey: `erector_complete:${created.id}`,
  }).catch(() => null);

  const completedRow = complete ?? created;
  await transitionBlueprintToPathSelection({
    blueprintId: input.blueprintId,
    userId: input.userId,
    validationId: completedRow.id,
    verdict: scores.verdict,
    selectedPath: resolveDefaultSelectedPath(scores.verdict),
    realityScore: scores.realityScore,
    intelligencePayload: intelligencePayload as Record<string, unknown>,
    pathOptions: {
      current: paths.current,
      adjusted: paths.adjusted,
      alternative: paths.alternative,
    },
    recommendedTier: scores.recommendedBlueprintLevel,
    validationKind: ValidationKind.ERECTOR,
  });

  const result = rowToErectorResult(completedRow);

  if (!input.skipBhudhiPanelEnrichment) {
    await enrichValidationAfterErector({
      validationId: created.id,
      userId: input.userId,
      blueprintId: input.blueprintId,
      ideaTitle: input.businessModel || input.rawGoal.slice(0, 80),
      goal: input.goalFinal ?? input.rawGoal,
      purpose: input.purposeFinal ?? input.purpose,
      timeframe: String(input.timeframe),
      context: input.currentContext,
      commitmentLevel: input.commitmentLevel,
      businessModel: input.businessModel,
      businessType: input.businessType,
      location: input.location,
    });
  }

  await populateWorkspaceAfterRun(created.id, result, {
    ...input,
    goalFinal: input.goalFinal,
    purposeFinal: input.purposeFinal,
    economicType: archetypeResolution.primaryArchetype.name,
  }).catch(() => null);
  return rowToErectorResult(
    (await db.select().from(validations).where(eq(validations.id, created.id)).limit(1))[0] ??
      completedRow,
  );
}
