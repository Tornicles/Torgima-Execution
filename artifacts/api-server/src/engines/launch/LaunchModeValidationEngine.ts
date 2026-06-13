/**
 * Deterministic validation engine for Launch Mode.
 * Never calls Bhudhi, Anthropic, or Erector AI pipelines.
 * Produces complete validation records with SWOT-style intelligence.
 */

import { randomUUID } from "crypto";
import { db, validations } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  scoreGoal,
  determineVerdict,
  generatePathsDeterministic,
} from "../validation/ValidationEngine.js";
import { resolveArchetype } from "../erector/ArchetypeResolutionEngine.js";
import { rowToErectorResult } from "../erector/ErectorOrchestrationHelpers.js";
import { transitionBlueprintToPathSelection } from "../../lib/transitionBlueprintToPathSelection.js";
import { resolveDefaultSelectedPath } from "../../lib/validationPathSelection.js";
import { resolveValidationTimeframeFields } from "../../lib/validationTimeframe.js";
import { logger } from "../../lib/logger.js";
import type { ErectorValidationInput, ErectorValidationResult } from "../../types/erector.js";
import { ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";

export type DeterministicIntel = {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  recommendations: string[];
};

export function buildDeterministicIntel(input: {
  goal: string;
  purpose?: string;
  scores: ReturnType<typeof scoreGoal>;
  verdict: ReturnType<typeof determineVerdict>;
  knownBlockers?: string[];
}): DeterministicIntel {
  const { scores, verdict } = input;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const opportunities: string[] = [];
  const risks: string[] = [];
  const recommendations: string[] = [];

  if (scores.clarity.score >= 60) strengths.push(scores.clarity.finding || "Goal clarity is sufficient to begin execution.");
  else weaknesses.push(scores.clarity.finding || "Goal needs sharper specificity.");

  if (scores.feasibility.score >= 60) strengths.push(scores.feasibility.finding || "Feasibility within a reasonable execution window.");
  else weaknesses.push(scores.feasibility.finding || "Scope or timeframe may be unrealistic.");

  if (scores.realism.score >= 60) strengths.push(scores.realism.finding || "Execution context supports the stated goal.");
  else weaknesses.push(scores.realism.finding || "Context or constraints need alignment.");

  if (scores.usefulness.score >= 60) strengths.push(scores.usefulness.finding || "Clear value proposition for the target outcome.");
  else weaknesses.push(scores.usefulness.finding || "Purpose or success signal needs definition.");

  opportunities.push(
    `Execute a scoped first proof for: ${input.goal.slice(0, 80)}`,
    input.purpose ? `Align daily actions with purpose: ${input.purpose.slice(0, 100)}` : "Define a measurable first milestone within 14 days.",
    "Use validation paths to compare current vs adjusted vs alternative execution angles.",
  );

  if (input.knownBlockers?.length) {
    for (const b of input.knownBlockers.slice(0, 3)) risks.push(b);
  }
  if (scores.overall < 50) risks.push("Overall validation score suggests high execution friction without scope adjustment.");
  if (verdict === "pivot") risks.push("Direction may need restructuring before scaling investment.");

  recommendations.push(
    verdict === "proceed"
      ? "Proceed with the adjusted path and launch a starter blueprint."
      : verdict === "adjust"
        ? "Select the adjusted path, tighten scope, and validate demand in the first cycle."
        : "Review the alternative path or refine goal specificity before launch.",
    "Complete the first 8 foundation tasks to establish execution momentum.",
    scores.clarity.suggestion ?? "Add measurable outcomes and a fixed timeframe anchor.",
  );

  return { strengths, weaknesses, opportunities, risks, recommendations };
}

function buildDeterministicSummary(
  scores: ReturnType<typeof scoreGoal>,
  verdict: ReturnType<typeof determineVerdict>,
): string {
  const verdictText = {
    proceed: "Your goal is clear enough to execute. Launch the blueprint and begin.",
    adjust: "Your goal has a good foundation but needs refinement before maximum execution speed.",
    pivot: "The goal needs significant restructuring before a controlled execution blueprint can be built.",
  }[verdict];
  return `Overall score: ${scores.overall}/100. ${verdictText}`;
}

function mapScoresToErector(scores: ReturnType<typeof scoreGoal>, verdict: string) {
  const reality = scores.overall;
  return {
    marketScore: Math.round((scores.usefulness.score + scores.clarity.score) / 2),
    executionScore: scores.feasibility.score,
    timingScore: scores.realism.score,
    competitionScore: 55,
    scalabilityScore: Math.min(85, scores.overall + 10),
    localEconomyScore: 60,
    resourceScore: scores.feasibility.score,
    blueprintDifficultyScore: Math.max(20, 100 - scores.overall),
    riskScore: Math.max(15, 100 - scores.realism.score),
    momentumPotential: Math.min(90, scores.overall + 5),
    trustBuildingScore: scores.clarity.score,
    realityScore: reality,
    verdict: verdict as ErectorValidationResult["verdict"],
    recommendedBlueprintLevel: (reality >= 70 ? "growth" : "starter") as ErectorValidationResult["recommendedBlueprintLevel"],
  };
}

/**
 * Run full deterministic validation — persists to DB, transitions blueprint.
 * Never throws on intelligence failures; only on unrecoverable DB errors.
 */
export async function runLaunchModeDeterministicValidation(
  input: ErectorValidationInput,
  fallbackReason?: string,
): Promise<ErectorValidationResult> {
  const goal = input.goalFinal ?? input.rawGoal;
  const purpose = input.purposeFinal ?? input.purpose;

  const goalScores = scoreGoal({
    goal,
    purpose,
    timeframe: input.timeframe,
    commitmentLevel: input.commitmentLevel,
    currentContext: input.currentContext,
    knownBlockers: input.knownBlockers?.join("; "),
    successSignal: input.successSignal,
  });
  const verdict = determineVerdict(goalScores);
  const erectorVerdict =
    verdict === "proceed" ? "proceed" : verdict === "pivot" ? "pivot" : "adjust";

  const paths = generatePathsDeterministic({
    goal,
    purpose,
    timeframe: input.timeframe,
    commitmentLevel: input.commitmentLevel,
    scores: goalScores,
    verdict,
  });

  const intel = buildDeterministicIntel({
    goal,
    purpose,
    scores: goalScores,
    verdict,
    knownBlockers: input.knownBlockers,
  });

  const timeframeFields = resolveValidationTimeframeFields({
    timeframe: input.timeframe,
    customTimeframeDays: input.customTimeframeDays,
  });

  const [existing] = await db
    .select()
    .from(validations)
    .where(eq(validations.idempotency_key, input.idempotencyKey))
    .limit(1)
    .catch(() => [] as Array<typeof validations.$inferSelect>);

  if (existing?.validation_stage === ValidationStatus.COMPLETE) {
    return rowToErectorResult(existing);
  }

  const contractId = existing?.contract_id ?? randomUUID();
  const erectorScores = mapScoresToErector(goalScores, erectorVerdict);

  let archetypeResolution;
  try {
    archetypeResolution = await resolveArchetype(input.location.country, input.location.city);
  } catch {
    archetypeResolution = await resolveArchetype("global", input.location.city);
  }

  const intelligencePayload = {
    launchMode: true,
    usedFallback: true,
    fallbackReason: fallbackReason ?? "deterministic_launch_mode",
    erector: false,
    deterministic: true,
    scores: erectorScores,
    strengths: intel.strengths,
    weaknesses: intel.weaknesses,
    opportunities: intel.opportunities,
    risks: intel.risks,
    recommendations: intel.recommendations,
    aiSummary: buildDeterministicSummary(goalScores, verdict),
    systemsProgress: { ERECTOR: "fallback", BHUDHI: "skipped", RESEARCH: "skipped" },
    tabs: {
      strengths: intel.strengths,
      weaknesses: intel.weaknesses,
      opportunities: intel.opportunities,
      risks: intel.risks,
      recommendations: intel.recommendations,
    },
  };

  const [row] = existing
    ? await db
        .update(validations)
        .set({
          validation_kind: ValidationKind.ERECTOR,
          status: ValidationStatus.COMPLETE,
          validation_stage: ValidationStatus.COMPLETE,
          erector_validation_stage: ErectorValidationStage.COMPLETE,
          contract_id: contractId,
          payload_version: 1,
          raw_goal: input.rawGoal,
          goal_final: goal,
          purpose_final: purpose,
          purpose,
          timeframe: timeframeFields.timeframe,
          timeframe_days: timeframeFields.timeframe_days,
          verdict: erectorVerdict,
          launch_blocked: false,
          readiness: erectorVerdict === "proceed" ? "ready_proceed" : "ready_with_adjustment",
          path_current: paths.current,
          path_adjusted: paths.adjusted,
          path_alternative: paths.alternative,
          reality_score: erectorScores.realityScore,
          market_score: erectorScores.marketScore,
          execution_score: erectorScores.executionScore,
          timing_score: erectorScores.timingScore,
          competition_score: erectorScores.competitionScore,
          scalability_score: erectorScores.scalabilityScore,
          local_economy_score: erectorScores.localEconomyScore,
          resource_score: erectorScores.resourceScore,
          blueprint_difficulty_score: erectorScores.blueprintDifficultyScore,
          risk_score: erectorScores.riskScore,
          momentum_potential: erectorScores.momentumPotential,
          trust_building_score: erectorScores.trustBuildingScore,
          recommended_blueprint_level: erectorScores.recommendedBlueprintLevel,
          archetype_resolution: archetypeResolution,
          intelligence_payload: intelligencePayload,
          ai_summary: intelligencePayload.aiSummary,
          tier_flow_status: "tier_presented",
          enriched_opportunities: intel.opportunities.map((o) => ({ title: o, description: o })),
          industry_pros: intel.strengths,
          industry_cons: intel.weaknesses,
        } as never)
        .where(eq(validations.id, existing.id))
        .returning()
    : await db
        .insert(validations)
        .values({
          blueprint_id: input.blueprintId,
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          contract_id: contractId,
          validation_kind: ValidationKind.ERECTOR,
          status: ValidationStatus.COMPLETE,
          validation_stage: ValidationStatus.COMPLETE,
          erector_validation_stage: ErectorValidationStage.COMPLETE,
          payload_version: 1,
          raw_goal: input.rawGoal,
          goal_final: goal,
          purpose_final: purpose,
          purpose,
          timeframe: timeframeFields.timeframe,
          timeframe_days: timeframeFields.timeframe_days,
          current_context: input.currentContext ?? null,
          location_country: input.location.country,
          location_city: input.location.city,
          domain: input.domainHint ?? null,
          commitment_level: input.commitmentLevel,
          verdict: erectorVerdict,
          launch_blocked: false,
          readiness: "ready_with_adjustment",
          path_current: paths.current,
          path_adjusted: paths.adjusted,
          path_alternative: paths.alternative,
          reality_score: erectorScores.realityScore,
          market_score: erectorScores.marketScore,
          execution_score: erectorScores.executionScore,
          timing_score: erectorScores.timingScore,
          competition_score: erectorScores.competitionScore,
          recommended_blueprint_level: erectorScores.recommendedBlueprintLevel,
          archetype_resolution: archetypeResolution,
          intelligence_payload: intelligencePayload,
          ai_summary: intelligencePayload.aiSummary,
          tier_flow_status: "tier_presented",
          enriched_opportunities: intel.opportunities.map((o) => ({ title: o, description: o })),
          industry_pros: intel.strengths,
          industry_cons: intel.weaknesses,
        } as never)
        .returning();

  if (!row) throw new Error("Launch mode validation persist failed");

  await transitionBlueprintToPathSelection({
    blueprintId: input.blueprintId,
    userId: input.userId,
    validationId: row.id,
    verdict: erectorVerdict,
    selectedPath: resolveDefaultSelectedPath(erectorVerdict),
    realityScore: erectorScores.realityScore,
    intelligencePayload,
    pathOptions: paths,
    recommendedTier: erectorScores.recommendedBlueprintLevel,
    validationKind: ValidationKind.ERECTOR,
  }).catch((err) => {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[LaunchModeValidation] blueprint transition failed (non-fatal)",
    );
  });

  logger.info(
    { validationId: row.id, blueprintId: input.blueprintId, fallbackReason },
    "[LaunchModeValidation] Deterministic validation complete",
  );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(validations)
    .catch(() => [{ count: -1 }]);

  logger.info({ count: countRow?.count }, "[LaunchModeValidation] DB write confirmed");

  return rowToErectorResult(row);
}
