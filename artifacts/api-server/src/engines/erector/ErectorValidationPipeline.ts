import { eq } from "drizzle-orm";

import {

  db,

  erectorIntakeSessions,

  erectorThresholdMatrix,

  erectorUserRealityProfiles,

  erectorValidationRuns,

} from "@workspace/db";

import { classifyEconomicType } from "./economic/EconomicTypeEngine.js";

import { evaluateRules } from "./ErectorRuleEngine.js";
import { resolveConflicts, resolveFreeTierConflicts } from "./RuleConflictResolver.js";
import {
  buildScoringContext,
  mapIntakeTierToMatrixTier,
  minimalFreeProfileFromRow,
  scoreDimensionsForFreeTier,
  scoreValidationDimensions,
  thresholdRowToTierThresholds,
} from "./ValidationScoringEngine.js";

import { issueVerdict } from "./VerdictIssuanceEngine.js";

import type { DimensionScores, FinalVerdictDecision, RuleEvaluationResult } from "./types/verdict-types.js";



export type ErectorValidationPipelineResult = {

  validation_run_id: string;

  profile_id: string;

  verdict: FinalVerdictDecision["verdict"];

  scores: DimensionScores;

  rule_results: RuleEvaluationResult;

  explanation_id: string;

};



export async function runErectorValidationPipeline(input: {

  sessionId: string;

  profileId: string;

  userId: string;

}): Promise<ErectorValidationPipelineResult> {

  const [session] = await db

    .select()

    .from(erectorIntakeSessions)

    .where(eq(erectorIntakeSessions.id, input.sessionId))

    .limit(1);

  if (!session) throw new Error("Intake session not found");



  const [profile] = await db

    .select()

    .from(erectorUserRealityProfiles)

    .where(eq(erectorUserRealityProfiles.id, input.profileId))

    .limit(1);

  if (!profile) throw new Error("Reality profile not found");



  const matrixTier = mapIntakeTierToMatrixTier(session.tier);

  const [thresholdRow] = await db

    .select()

    .from(erectorThresholdMatrix)

    .where(eq(erectorThresholdMatrix.tier, matrixTier))

    .limit(1);

  if (!thresholdRow) throw new Error(`Missing threshold matrix for ${matrixTier}`);



  const [validationRun] = await db

    .insert(erectorValidationRuns)

    .values({

      user_id: input.userId,

      intake_session_id: input.sessionId,

      reality_profile_id: input.profileId,

      tier: matrixTier,

      status: "running",

      contradiction_score: 0,

    })

    .returning({ id: erectorValidationRuns.id });



  if (!validationRun) throw new Error("Failed to create validation run");



  const economic = await classifyEconomicType({

    validationRunId: validationRun.id,

    profileId: input.profileId,

    userId: input.userId,

    tier: session.tier,

    blueprintId: session.blueprint_id,

  });



  const archetypeId = economic.primary_archetype;

  const isFreeTier = session.tier === "free";
  const thresholds = thresholdRowToTierThresholds(thresholdRow);
  const scores = isFreeTier
    ? scoreDimensionsForFreeTier(minimalFreeProfileFromRow(profile))
    : scoreValidationDimensions(
        buildScoringContext(profile, {
          missing_fields: session.missing_fields,
          contradiction_flags: session.contradiction_flags,
        }),
        thresholds,
        archetypeId,
      );

  const ruleResults = await evaluateRules(

    validationRun.id,

    input.userId,

    input.profileId,

    scores,

    session.tier,

    archetypeId,

    {

      missing_fields: session.missing_fields ?? [],

      contradiction_flags: session.contradiction_flags ?? [],

      regulatory_flags: profile.regulatory_flags ?? [],

    },

    economic.rule_pack,

  );



  const finalVerdict = isFreeTier
    ? resolveFreeTierConflicts(ruleResults, scores)
    : resolveConflicts(ruleResults, scores, thresholds);

  const issued = await issueVerdict(

    validationRun.id,

    input.userId,

    input.sessionId,

    finalVerdict,

    scores,

    ruleResults,

    input.profileId,

  );



  return {

    validation_run_id: validationRun.id,

    profile_id: input.profileId,

    verdict: finalVerdict.verdict,

    scores,

    rule_results: ruleResults,

    explanation_id: issued.explanation_id,

  };

}


