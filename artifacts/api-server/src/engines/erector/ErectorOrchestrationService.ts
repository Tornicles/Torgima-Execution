import { db, validations, validationArchetypeMaps } from "@workspace/db";
import { eq } from "drizzle-orm";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { validatePayload } from "../../lib/validationPayloadSchemas.js";
import type {
  ArchetypeResolutionOutput,
  ErectorValidationInput,
  ErectorValidationResult,
  TimeSimulationOutput,
  ValidationPathOutput,
} from "../../types/erector.js";
import { resolveArchetype } from "./ArchetypeResolutionEngine.js";
import { calculateAllScores } from "./ScoringEngine.js";
import { buildErectorOutputs, ensureEconomicArchetypesSeeded } from "./ErectorIntelligenceBridge.js";
import { ValidationKind, ValidationStatus } from "@workspace/state-machine";

function buildSimulations(input: ErectorValidationInput, scores: ReturnType<typeof calculateAllScores>): TimeSimulationOutput[] {
  const base = scores.realityScore >= 7 ? 0.72 : scores.realityScore >= 4 ? 0.48 : 0.24;
  return ["30d", "90d", "6m", "1yr"].map((timeframe, index) => ({
    timeframe,
    dailyTaskCount: { min: 1 + index, max: 2 + index * 2, average: 1.5 + index },
    weeklyOutputRequirements: ["Produce proof assets", "Validate demand signal", "Submit execution feedback"],
    estimatedRevenueTimeline: timeframe === "30d" ? "Validation, not dependable revenue." : "Possible after repeated proof and conversion tests.",
    requiredCapitalBurn: Math.round(input.budgetAvailable * (0.15 + index * 0.1)),
    executionIntensityLabel: index === 0 ? "very_high" : index === 1 ? "high" : "moderate",
    probabilityOfReachingGoal: Number(Math.max(0.05, Math.min(0.9, base + index * 0.07)).toFixed(2)),
    majorRiskPoints: ["Weak proof", "Distribution lag", "Budget/time mismatch"],
    criticalSuccessFactors: ["Narrow segment", "Visible proof", "Weekly adaptation"],
  }));
}

function path(pathType: ValidationPathOutput["pathType"], scores: ReturnType<typeof calculateAllScores>): ValidationPathOutput & Record<string, unknown> {
  const adjusted = pathType === "adjusted";
  const alternative = pathType === "alternative";
  const disabled = scores.verdict === "pivot" && pathType === "current";
  const probability = Math.max(0.05, Math.min(0.85, scores.realityScore / 10 + (adjusted ? 0.12 : alternative ? 0.18 : 0)));
  return {
    pathType,
    type: pathType,
    title: alternative ? "Alternative Path" : adjusted ? "Adjusted Path" : "Current Path",
    description: alternative ? "Change the execution wedge before launch." : adjusted ? "Keep the goal but reduce scope and increase proof cadence." : "Execute the stated goal under current assumptions.",
    summary: alternative ? "Pivot the first market or model." : adjusted ? "Modify scope before blueprint launch." : "Proceed with current assumptions.",
    rationale: "Path generated from economy-adjusted validation scores.",
    expectedOutcome: "Estimated progress depends on execution evidence and signal quality.",
    riskLevel: scores.riskScore >= 7 ? "high" : scores.riskScore >= 4 ? "medium" : "low",
    modifications: adjusted ? ["Narrow target customer", "Extend timeline", "Increase proof cadence"] : alternative ? ["Change wedge", "Lower capital exposure", "Validate demand first"] : [],
    expectedDifficulty: scores.blueprintDifficultyScore >= 7 ? "high" : "moderate",
    probabilityOfSuccess: Number(probability.toFixed(2)),
    timelineAdjustment: adjusted ? "Add 30-60 days of validation time." : alternative ? "Restart with lower-risk wedge." : "Base timeframe retained.",
    blueprintLevelRecommendation: scores.recommendedBlueprintLevel,
    keyRisks: ["Demand uncertainty", "Execution consistency", "Trust-building delay"],
    keyAdvantages: adjusted ? ["Lower risk", "Clearer market proof"] : alternative ? ["Avoids weakest assumptions"] : ["Fastest start"],
    firstWeekActionsPreview: ["Define proof target", "Interview customer segment", "Ship first visible artifact"],
    disabled,
    disabledReason: disabled ? "Reality Score below 4.0. Current path cannot launch." : undefined,
    planSkeleton: { plans: [{ name: "Reality-tested launch", description: "First execution plan from Erector output." }], targets: [{ name: "First proof signal", type: "primary" }] },
  };
}

function rowToResult(row: typeof validations.$inferSelect): ErectorValidationResult {
  return {
    validationId: row.id,
    blueprintId: row.blueprint_id,
    validationStage: row.validation_stage ?? row.status,
    verdict: (row.verdict ?? "adjust") as ErectorValidationResult["verdict"],
    scores: {
      marketScore: row.market_score ?? 0,
      executionScore: row.execution_score ?? 0,
      timingScore: row.timing_score ?? 0,
      competitionScore: row.competition_score ?? 0,
      scalabilityScore: row.scalability_score ?? 0,
      localEconomyScore: row.local_economy_score ?? 0,
      resourceScore: row.resource_score ?? 0,
      blueprintDifficultyScore: row.blueprint_difficulty_score ?? 0,
      riskScore: row.risk_score ?? 0,
      momentumPotential: row.momentum_potential ?? 0,
      trustBuildingScore: row.trust_building_score ?? 0,
      realityScore: row.reality_score ?? 0,
      verdict: (row.verdict ?? "adjust") as ErectorValidationResult["verdict"],
      recommendedBlueprintLevel: (row.recommended_blueprint_level ?? "starter") as ErectorValidationResult["recommendedBlueprintLevel"],
    },
    archetypeResolution: row.archetype_resolution as ErectorValidationResult["archetypeResolution"],
    purposeDecomposition: (row.purpose_decomposition as Record<string, unknown>) ?? {},
    industryIntelligence: (row.industry_intelligence as Record<string, unknown>) ?? {},
    marketAnalysis: (row.market_analysis as Record<string, unknown>) ?? {},
    competitorAnalysis: (row.competitor_analysis as Record<string, unknown>) ?? {},
    economyBriefing: (row.economy_briefing as Record<string, unknown>) ?? {},
    customerPainAnalysis: (row.customer_pain_analysis as Record<string, unknown>) ?? {},
    executionDifficulty: (row.execution_difficulty as Record<string, unknown>) ?? {},
    timeSimulations: (row.time_simulations as ErectorValidationResult["timeSimulations"]) ?? [],
    paths: {
      current: row.path_current as ErectorValidationResult["paths"]["current"],
      adjusted: row.path_adjusted as ErectorValidationResult["paths"]["adjusted"],
      alternative: row.path_alternative as ErectorValidationResult["paths"]["alternative"],
    },
    recommendedBlueprintLevel: (row.recommended_blueprint_level ?? "starter") as ErectorValidationResult["recommendedBlueprintLevel"],
  };
}

export async function runErectorValidation(input: ErectorValidationInput): Promise<ErectorValidationResult> {
  await ensureEconomicArchetypesSeeded();

  const [existing] = await db
    .select()
    .from(validations)
    .where(eq(validations.idempotency_key, input.idempotencyKey))
    .limit(1)
    .catch(() => [] as Array<typeof validations.$inferSelect>);
  if (existing?.validation_stage === ValidationStatus.COMPLETE) return rowToResult(existing);

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
          location_country: input.location.country,
          location_city: input.location.city,
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

  const archetypeResolution = await resolveArchetype(input.location.country, input.location.city);
  await db.update(validations).set({ archetype_resolution: archetypeResolution, validation_stage: "archetype_resolved" }).where(eq(validations.id, created.id));
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
  const simulations = buildSimulations(input, scores);
  const paths = {
    current: path("current", scores),
    adjusted: path("adjusted", scores),
    alternative: path("alternative", scores),
  };
  const intelligencePayload = {
    erector: true,
    archetypeResolution,
    scores,
    economyBriefing: outputs.economyBriefing,
    bhudhiTriggerCount: outputs.bhudhiTriggerCount,
    bhudhiFallbackCount: outputs.bhudhiFallbackCount,
    systemsProgress: { ERECTOR: "complete" },
  };
  const payloadCheck = validatePayload(ValidationKind.ERECTOR, intelligencePayload);
  if (!payloadCheck.success) {
    throw new Error(`Erector payload failed schema check: ${payloadCheck.error.message}`);
  }

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
      launch_blocked: scores.verdict === "pivot",
      readiness: scores.verdict === "proceed" ? "ready_proceed" : scores.verdict === "adjust" ? "ready_with_adjustment" : "blocked_pivot",
      validation_stage: "complete",
      status: ValidationStatus.COMPLETE,
      validation_kind: ValidationKind.ERECTOR,
      payload_version: 1,
      intelligence_payload: intelligencePayload,
    })
    .where(eq(validations.id, created.id))
    .returning();

  await writeEvent({
    eventType: EVENT_TYPES.VALIDATION_COMPLETED,
    entityType: "validation",
    entityId: created.id,
    userId: input.userId,
    blueprintId: input.blueprintId,
    payload: { validationId: created.id, realityScore: scores.realityScore, verdict: scores.verdict },
    idempotencyKey: `erector_validation_completed:${created.id}`,
  }).catch(() => null);

  return rowToResult(complete ?? created);
}
