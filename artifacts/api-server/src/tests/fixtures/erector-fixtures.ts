/**
 * Prompt 9 — Erector test fixtures (database seeds for acceptance + E2E).
 */
import {
  db,
  users,
  blueprints,
  validations,
  orders,
  events,
  bhudhiLogs,
  economicArchetypes,
  capabilityProfiles,
  signalSnapshots,
  conditions,
  enforcementPackages,
  stateMemory,
  feedback,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createTestUser, createTestBlueprint, createInitialState } from "../helpers/db.js";
import { resolveArchetype } from "../../engines/erector/ArchetypeResolutionEngine.js";
import { buildDeterministicErectorPayload } from "../../engines/erector/ErectorDeterministicPayload.js";
import { buildTimeSimulations } from "../../engines/erector/PathEngine.js";
import { generatePaths } from "../../engines/erector/PathEngine.js";
import type { ErectorScores, ErectorValidationInput } from "../../types/erector.js";
import { EventTypes } from "../../types/eventContracts.js";
import {
  BlueprintStatus,
  ErectorValidationStage,
  EventStatus,
  OrderStatus,
  ValidationKind,
  ValidationStatus,
} from "@workspace/state-machine";
import { seedEconomicArchetypes } from "../../engines/erector/seedArchetypes.js";
import { extractLockedIntelFromValidation } from "../../engines/erector/ErectorExecutionBridge.js";
import { ERECTOR_BHUDHI_CALLS } from "../../bhudhi/erector-prompts.js";

export type ErectorFixtureName =
  | "erectorValidationProceed"
  | "erectorValidationAdjust"
  | "erectorValidationPivot"
  | "erectorValidationBlocked"
  | "erectorBlueprintLaunched"
  | "erectorArchetypeNigeria"
  | "erectorArchetypeGermany"
  | "erectorArchetypeIran"
  | "erectorSmokeTestsComplete"
  | "erectorFallbackMode";

export const ERECTOR_FIXTURE_NAMES: readonly ErectorFixtureName[] = [
  "erectorValidationProceed",
  "erectorValidationAdjust",
  "erectorValidationPivot",
  "erectorValidationBlocked",
  "erectorBlueprintLaunched",
  "erectorArchetypeNigeria",
  "erectorArchetypeGermany",
  "erectorArchetypeIran",
  "erectorSmokeTestsComplete",
  "erectorFallbackMode",
];

export interface ErectorFixture {
  name: ErectorFixtureName;
  userId: string;
  blueprintId: string;
  validationId: string;
  validationContractId: string;
}

const STANDARD_GOAL =
  "Launch an online consulting business serving founder-operators with measurable outcomes in 90 days";

let archetypesSeeded = false;
async function ensureArchetypesSeeded(): Promise<void> {
  if (!archetypesSeeded) {
    await seedEconomicArchetypes();
    archetypesSeeded = true;
  }
}

function baseErectorInput(
  userId: string,
  blueprintId: string,
  country: string,
  city?: string,
): ErectorValidationInput {
  return {
    userId,
    blueprintId,
    idempotencyKey: `fixture-${country}-${Date.now()}`,
    rawGoal: STANDARD_GOAL,
    purpose: "Build reliable income through a narrow proof wedge.",
    timeframe: "90d",
    commitmentLevel: "HIGH",
    desiredOutcome: "Ten paying clients with documented outcomes.",
    location: { country, city },
    businessType: "online",
    businessModel: "Consulting",
    budgetAvailable: 8000,
    currency: "USD",
    currentResources: ["Skills", "Network", "Time"],
    targetCustomer: "Founder-operators",
    knownBlockers: [],
    currentContext: "Building from an existing skill base.",
  };
}

function scoresForReality(realityScore: number): ErectorScores {
  const verdict =
    realityScore >= 6.5 ? "proceed"
    : realityScore >= 4 ? "adjust"
    : realityScore >= 2.5 ? "pivot"
    : "blocked";
  const level = realityScore >= 7 ? "growth" : realityScore >= 5 ? "growth" : "starter";
  return {
    marketScore: realityScore,
    executionScore: realityScore - 0.2,
    timingScore: realityScore - 0.1,
    competitionScore: realityScore - 0.3,
    scalabilityScore: realityScore,
    localEconomyScore: realityScore,
    resourceScore: realityScore,
    blueprintDifficultyScore: 5.5,
    momentumPotential: realityScore,
    trustBuildingScore: realityScore,
    riskScore: 10 - realityScore,
    realityScore,
    verdict,
    recommendedBlueprintLevel: level,
  };
}

function firstWeekPlan() {
  const days = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    actions: [
      {
        title: `Smoke test day ${index + 1}`,
        description: "Complete one verifiable smoke test action.",
        type: "execution",
        economyContext: "Erector fixture",
      },
    ],
  }));
  return {
    days,
    plans: days.map((d, i) => ({
      title: d.actions[0]!.title,
      action: d.actions[0]!.description,
      expectedOutput: "Proof recorded.",
      archetypeSpecific: "Fixture economy context",
      smokeTest: i < 2 || i === 0,
    })),
  };
}

async function seedValidationRow(params: {
  userId: string;
  blueprintId: string;
  input: ErectorValidationInput;
  scores: ErectorScores;
  selectedPath?: "current" | "adjusted" | "alternative" | null;
  blueprintStatus?: BlueprintStatus;
  includeFirstWeek?: boolean;
  intelligenceLimited?: boolean;
}): Promise<{ validationId: string; validationContractId: string }> {
  await ensureArchetypesSeeded();
  const archetype = await resolveArchetype(params.input.location.country, params.input.location.city);
  const outputs = buildDeterministicErectorPayload(params.input, archetype);
  const simulations = await buildTimeSimulations(params.input, archetype, params.scores, "fixture-val");
  const paths = await generatePaths(params.input, archetype, params.scores, simulations, "fixture-val");
  const fwp = params.includeFirstWeek !== false ? firstWeekPlan() : null;

  const [val] = await db
    .insert(validations)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      raw_goal: params.input.rawGoal,
      purpose: params.input.purpose,
      timeframe: params.input.timeframe,
      commitment_level: params.input.commitmentLevel,
      location_country: params.input.location.country,
      location_city: params.input.location.city,
      business_type: params.input.businessType,
      business_model: params.input.businessModel,
      budget_available: params.input.budgetAvailable,
      currency: params.input.currency,
      current_resources: params.input.currentResources,
      target_customer: params.input.targetCustomer,
      status: ValidationStatus.COMPLETE,
      validation_stage: ValidationStatus.COMPLETE,
      erector_validation_stage: ErectorValidationStage.COMPLETE,
      validation_kind: ValidationKind.ERECTOR,
      payload_version: 1,
      reality_score: params.scores.realityScore,
      market_score: params.scores.marketScore,
      execution_score: params.scores.executionScore,
      timing_score: params.scores.timingScore,
      competition_score: params.scores.competitionScore,
      scalability_score: params.scores.scalabilityScore,
      local_economy_score: params.scores.localEconomyScore,
      resource_score: params.scores.resourceScore,
      blueprint_difficulty_score: params.scores.blueprintDifficultyScore,
      risk_score: params.scores.riskScore,
      momentum_potential: params.scores.momentumPotential,
      trust_building_score: params.scores.trustBuildingScore,
      verdict: params.scores.verdict,
      launch_blocked: params.scores.verdict === "blocked" || params.scores.verdict === "pivot",
      recommended_blueprint_level: params.scores.recommendedBlueprintLevel,
      archetype_resolution: archetype,
      purpose_decomposition: outputs.purposeDecomposition,
      industry_intelligence: outputs.industryIntelligence,
      market_analysis: outputs.marketAnalysis,
      competitor_analysis: outputs.competitorAnalysis,
      economy_briefing: outputs.economyBriefing,
      customer_pain_analysis: outputs.customerPainAnalysis,
      execution_difficulty: outputs.executionDifficulty,
      timing_analysis: outputs.timingAnalysis,
      time_simulations: simulations,
      path_current: paths.current,
      path_adjusted: paths.adjusted,
      path_alternative: paths.alternative,
      first_week_plan: fwp,
      selected_path: params.selectedPath ?? undefined,
      selected_path_type: params.selectedPath ?? undefined,
      selected_at: params.selectedPath ? new Date() : undefined,
      intelligence_payload: {
        erector: true,
        intelligence_limited: params.intelligenceLimited ?? false,
        scores: params.scores,
        archetypeResolution: archetype,
        economyBriefing: outputs.economyBriefing,
      },
      erector_payload: { archetype, outputs, paths, scores: params.scores },
    })
    .returning({ id: validations.id, contract_id: validations.contract_id });

  if (!val) throw new Error("validation insert failed");

  await db
    .update(blueprints)
    .set({
      status: params.blueprintStatus ?? BlueprintStatus.PATH_SELECTION,
      validation_id: val.id,
      erector_validation_id: val.id,
    })
    .where(eq(blueprints.id, params.blueprintId));

  return { validationId: val.id, validationContractId: val.contract_id };
}

async function seedSmokeOrders(blueprintId: string, userId: string, allComplete: boolean): Promise<void> {
  for (let i = 0; i < 7; i++) {
    await db.insert(orders).values({
      blueprint_id: blueprintId,
      user_id: userId,
      task_type: i === 0 ? "smoke_test" : "execution",
      title: `Smoke test day ${i + 1}`,
      instruction: "Complete smoke test action.",
      expected_output: "Proof.",
      definition_of_done: "Done.",
      difficulty: "easy",
      priority: i + 1,
      generation_reason: "erector_first_week_seed",
      status: allComplete ? OrderStatus.COMPLETED : i === 0 ? OrderStatus.PENDING : OrderStatus.PRE_GENERATED,
      proof_required: true,
      domain: "delivery",
    });
  }
}

export async function seedErectorFixture(name: ErectorFixtureName): Promise<ErectorFixture> {
  const user = await createTestUser({ display_name: `Erector ${name}` });
  const bp = await createTestBlueprint(user.id, {
    status: "draft",
    active: false,
    goal: STANDARD_GOAL,
    raw_goal: STANDARD_GOAL,
  });

  switch (name) {
    case "erectorValidationProceed": {
      const input = baseErectorInput(user.id, bp.id, "United States", "Austin");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: { ...scoresForReality(7.2), recommendedBlueprintLevel: "growth" },
        selectedPath: "current",
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorValidationAdjust": {
      const input = baseErectorInput(user.id, bp.id, "United States", "Chicago");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(5.1),
        selectedPath: "adjusted",
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorValidationPivot": {
      const input = baseErectorInput(user.id, bp.id, "United States", "Detroit");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(3.2),
        selectedPath: null,
        includeFirstWeek: false,
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorValidationBlocked": {
      const input = baseErectorInput(user.id, bp.id, "United States", "Miami");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(2.1),
        selectedPath: null,
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorArchetypeNigeria": {
      const input = baseErectorInput(user.id, bp.id, "Nigeria", "Lagos");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(6.8),
        selectedPath: "current",
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorArchetypeGermany": {
      const input = baseErectorInput(user.id, bp.id, "Germany", "Berlin");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(6.9),
        selectedPath: "current",
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorArchetypeIran": {
      const input = baseErectorInput(user.id, bp.id, "Iran", "Tehran");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(5.5),
        selectedPath: "adjusted",
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorFallbackMode": {
      const input = baseErectorInput(user.id, bp.id, "Kenya", "Nairobi");
      const scores = scoresForReality(6.0);
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores,
        selectedPath: "current",
        intelligenceLimited: true,
      });
      for (const call of ERECTOR_BHUDHI_CALLS) {
        await db.insert(bhudhiLogs).values({
          user_id: user.id,
          blueprint_id: bp.id,
          request_type: "blueprint_generation",
          trigger_type: "erector_analysis",
          response_type: call.outputType,
          fallback_used: true,
          output_json: { fallback: true },
          validation_status: "fallback_used",
        });
      }
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorBlueprintLaunched": {
      const input = baseErectorInput(user.id, bp.id, "Nigeria", "Lagos");
      const scores = scoresForReality(7.2);
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores,
        selectedPath: "current",
        blueprintStatus: BlueprintStatus.ACTIVE,
      });
      const [valRow] = await db.select().from(validations).where(eq(validations.id, validationId)).limit(1);
      const archetypeResolved = await resolveArchetype("Nigeria", "Lagos");
      const primaryId = archetypeResolved.primaryArchetype.id.startsWith("seed-")
        ? null
        : archetypeResolved.primaryArchetype.id;
      const intel = extractLockedIntelFromValidation(valRow!, primaryId);
      await db
        .update(blueprints)
        .set({
          status: BlueprintStatus.ACTIVE,
          active: true,
          validation_id: validationId,
          erector_validation_id: validationId,
          reality_score: intel.realityScore,
          blueprint_tier: intel.blueprintTier,
          primary_archetype_id: intel.primaryArchetypeId,
          industry_state: intel.industryState,
          archetype_execution_mult: intel.archetypeExecutionMult,
          archetype_timeframe_mult: intel.archetypeTimeframeMult,
          archetype_difficulty_adj: intel.archetypeDifficultyAdj,
        })
        .where(eq(blueprints.id, bp.id));
      await createInitialState(bp.id, user.id);
      await seedSmokeOrders(bp.id, user.id, false);
      await db.insert(events).values({
        event_type: EventTypes.ERECTOR_BLUEPRINT_LAUNCHED,
        entity_type: "blueprint",
        entity_id: bp.id,
        user_id: user.id,
        blueprint_id: bp.id,
        payload: { blueprint_id: bp.id, validation_id: validationId },
        idempotency_key: `fixture_launch:${bp.id}`,
        status: EventStatus.PROCESSED,
      });
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    case "erectorSmokeTestsComplete": {
      const input = baseErectorInput(user.id, bp.id, "Germany", "Munich");
      const { validationId, validationContractId } = await seedValidationRow({
        userId: user.id,
        blueprintId: bp.id,
        input,
        scores: scoresForReality(7.0),
        selectedPath: "current",
        blueprintStatus: BlueprintStatus.ACTIVE,
      });
      await db
        .update(blueprints)
        .set({ status: BlueprintStatus.ACTIVE, active: true })
        .where(eq(blueprints.id, bp.id));
      await createInitialState(bp.id, user.id);
      await seedSmokeOrders(bp.id, user.id, true);
      return { name, userId: user.id, blueprintId: bp.id, validationId, validationContractId };
    }

    default:
      throw new Error(`Unknown Erector fixture: ${name satisfies never}`);
  }
}

export async function cleanupErectorFixture(userId: string): Promise<void> {
  const bps = await db.select({ id: blueprints.id }).from(blueprints).where(eq(blueprints.user_id, userId));
  const bpIds = bps.map((b) => b.id);
  if (bpIds.length) {
    await db.delete(feedback).where(inArray(feedback.blueprint_id, bpIds));
    await db.delete(orders).where(inArray(orders.blueprint_id, bpIds));
    await db.delete(stateMemory).where(inArray(stateMemory.blueprint_id, bpIds));
    await db.delete(enforcementPackages).where(inArray(enforcementPackages.blueprint_id, bpIds));
    await db.delete(conditions).where(inArray(conditions.blueprint_id, bpIds));
    await db.delete(signalSnapshots).where(inArray(signalSnapshots.blueprint_id, bpIds));
    await db.delete(events).where(inArray(events.blueprint_id, bpIds));
    await db.delete(bhudhiLogs).where(inArray(bhudhiLogs.blueprint_id, bpIds));
    await db.delete(validations).where(inArray(validations.blueprint_id, bpIds));
    await db
      .update(capabilityProfiles)
      .set({ blueprint_id: null })
      .where(eq(capabilityProfiles.user_id, userId));
    await db.delete(blueprints).where(inArray(blueprints.id, bpIds));
  }
  await db.delete(users).where(eq(users.id, userId));
}

/** Stuck validation row for health check item 40. */
export async function seedStuckValidationFixture(): Promise<{ validationId: string; userId: string }> {
  const user = await createTestUser({ display_name: "Erector stuck validation" });
  const bp = await createTestBlueprint(user.id, { status: BlueprintStatus.VALIDATING, active: false });
  const [val] = await db
    .insert(validations)
    .values({
      user_id: user.id,
      blueprint_id: bp.id,
      raw_goal: STANDARD_GOAL,
      status: ValidationStatus.RUNNING,
      validation_stage: ValidationStatus.RUNNING,
      erector_validation_stage: ErectorValidationStage.RUNNING,
      validation_kind: ValidationKind.ERECTOR,
      updated_at: new Date(Date.now() - 10 * 60 * 1000),
    })
    .returning({ id: validations.id });
  return { validationId: val!.id, userId: user.id };
}

export async function countArchetypesWithSubstance(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(economicArchetypes)
    .where(sql`length(trim(name)) > 3`);
  return row?.count ?? 0;
}
