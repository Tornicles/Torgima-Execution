import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorArchetypeClassifications,
  erectorBlueprintLaunchContracts,
  erectorCorrectionPaths,
  erectorDecisionAudits,
  erectorIntakeSessions,
  erectorUserRealityProfiles,
  erectorValidationRuns,
} from "@workspace/db";
import { EVENT_TYPES, writeEvent } from "../../services/EventService.js";
import { loadArchetypeRulePack } from "./economic/ArchetypeRulePackLoader.js";
import { runErectorValidationPipeline } from "./ErectorValidationPipeline.js";
import { generateThreePaths, pathObjectToValidationPayload } from "./generateThreePaths.js";
import { updateBlueprintErectorState } from "./erectorStateMachine.js";
import { mapIntakeTierToMatrixTier } from "./ValidationScoringEngine.js";
import type { DimensionScores, FinalVerdictDecision, RuleEvaluationResult } from "./types/verdict-types.js";

export interface ValidationOrchestratorResult {
  validation_run_id: string;
  verdict: "PROCEED" | "ADJUST" | "PIVOT";
  verdict_confidence: "LOW" | "MEDIUM" | "HIGH";
  selected_path: "current" | "adjusted" | "alternative" | null;
  paths: ReturnType<typeof generateThreePaths>;
  archetype: string;
  scores: DimensionScores;
  hard_blockers: string[];
  soft_warnings: string[];
  correction_required: boolean;
  explanation_id: string;
  launch_contract_id: string | null;
  requires_simulation: boolean;
}

function verdictConfidence(verdict: string): ValidationOrchestratorResult["verdict_confidence"] {
  if (verdict === "PROCEED") return "HIGH";
  if (verdict === "ADJUST") return "MEDIUM";
  return "LOW";
}

function recommendedPathForVerdict(
  verdict: "PROCEED" | "ADJUST" | "PIVOT",
): "current" | "adjusted" | "alternative" {
  if (verdict === "PIVOT") return "alternative";
  if (verdict === "ADJUST") return "adjusted";
  return "current";
}

async function loadIntakeSession(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(erectorIntakeSessions)
    .where(and(eq(erectorIntakeSessions.id, sessionId), eq(erectorIntakeSessions.user_id, userId)))
    .limit(1);
  if (!session) throw new Error("Intake session not found");
  return session;
}

async function loadRealityProfile(sessionId: string, userId: string) {
  const [profile] = await db
    .select()
    .from(erectorUserRealityProfiles)
    .where(
      and(
        eq(erectorUserRealityProfiles.intake_session_id, sessionId),
        eq(erectorUserRealityProfiles.user_id, userId),
      ),
    )
    .orderBy(desc(erectorUserRealityProfiles.created_at))
    .limit(1);
  if (!profile) throw new Error("Reality profile not found");
  return profile;
}

async function getRunNumber(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(erectorValidationRuns)
    .where(eq(erectorValidationRuns.user_id, userId));
  return (row?.count ?? 0) + 1;
}

async function loadClassification(validationRunId: string) {
  const [row] = await db
    .select()
    .from(erectorArchetypeClassifications)
    .where(eq(erectorArchetypeClassifications.validation_run_id, validationRunId))
    .limit(1);
  return row ?? null;
}

async function createBlueprintLaunchContract(input: {
  userId: string;
  blueprintId: string;
  validationRunId: string;
  classificationId: string | null;
  profile: typeof erectorUserRealityProfiles.$inferSelect;
  finalVerdict: FinalVerdictDecision;
  archetypeId: string;
  tier: string;
  auditId: string;
  hardBlockers: string[];
  softWarnings: string[];
}): Promise<string> {
  const [contract] = await db
    .insert(erectorBlueprintLaunchContracts)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      validation_run_id: input.validationRunId,
      archetype_classification_id: input.classificationId,
      launch_permission: "PENDING",
      structured_goal: input.profile.structured_goal,
      structured_purpose: input.profile.structured_purpose,
      selected_path: input.finalVerdict.recommended_path,
      economic_archetype: input.archetypeId,
      policy_rules: [],
      policy_dont: [],
      risk_flags: input.hardBlockers,
      hard_blockers: input.hardBlockers,
      soft_blockers: input.softWarnings,
      winning_conditions: [],
      failure_conditions: [],
      tier: mapIntakeTierToMatrixTier(input.tier),
      audit_id: input.auditId,
    })
    .returning({ id: erectorBlueprintLaunchContracts.id });

  if (!contract) throw new Error("Failed to create blueprint launch contract");
  return contract.id;
}

async function createCorrectionFlow(input: {
  userId: string;
  sessionId: string;
  blueprintId: string | null;
  validationRunId: string;
  finalVerdict: FinalVerdictDecision;
  ruleResults: RuleEvaluationResult;
  auditId: string;
}): Promise<void> {
  const requiredActions = input.finalVerdict.correction_fields.length
    ? input.finalVerdict.correction_fields
    : input.ruleResults.hard_blockers;

  await db.insert(erectorCorrectionPaths).values({
    user_id: input.userId,
    blueprint_id: input.blueprintId,
    validation_run_id: input.validationRunId,
    source_engine: "ErectorValidationOrchestrator",
    source_id: input.validationRunId,
    correction_type: "VALIDATION_ADJUST",
    blocked_action: "blueprint_launch",
    reason: input.finalVerdict.hard_blockers.join("; ") || "Validation adjustments required",
    user_visible_reason: "Your validation requires corrections before launch.",
    required_actions: requiredActions,
    required_evidence: [],
    revalidation_required: true,
    unblock_condition: "Revalidation returns PROCEED verdict",
    audit_id: input.auditId as unknown as string,
  });

  if (input.blueprintId) {
    await updateBlueprintErectorState(input.blueprintId, "CORRECTION_REQUIRED");
  }

  await db
    .update(erectorIntakeSessions)
    .set({ status: "in_progress", current_section: 1 })
    .where(eq(erectorIntakeSessions.id, input.sessionId));

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_CORRECTION_REQUIRED,
    entityType: "erector_validation_run",
    entityId: input.validationRunId,
    userId: input.userId,
    blueprintId: input.blueprintId ?? undefined,
    payload: {
      validation_run_id: input.validationRunId,
      session_id: input.sessionId,
      correction_fields: input.finalVerdict.correction_fields,
    },
    idempotencyKey: `erector_correction_required:${input.validationRunId}`,
  });
}

async function writeOrchestratorAudit(input: {
  auditId: string;
  userId: string;
  validationRunId: string;
  scores: DimensionScores;
  ruleResults: RuleEvaluationResult;
  finalVerdict: FinalVerdictDecision;
  explanationId: string;
}): Promise<void> {
  await db.insert(erectorDecisionAudits).values({
    decision_id: input.auditId,
    decision_type: "verdict_issued",
    source_engine: "ErectorValidationOrchestrator",
    user_id: input.userId,
    entity_type: "erector_validation_run",
    entity_id: input.validationRunId,
    input_snapshot: {
      scores: input.scores,
      rules_fired: input.ruleResults.rules_fired,
    },
    rules_applied: input.ruleResults.rules_fired,
    result: input.finalVerdict.verdict,
    result_detail: {
      reasoning: input.finalVerdict.reasoning,
      recommended_path: input.finalVerdict.recommended_path,
    },
    explanation_id: input.explanationId,
    downstream_effects: ["erector_validation_completed"],
    user_visible: true,
  });
}

export async function runValidationOrchestrator(
  sessionId: string,
  userId: string,
  tier?: string,
): Promise<ValidationOrchestratorResult> {
  const auditId = randomUUID();
  const session = await loadIntakeSession(sessionId, userId);

  if (!session.validation_ready) {
    throw new Error("INTAKE_NOT_READY");
  }

  const profile = await loadRealityProfile(sessionId, userId);
  const effectiveTier = tier ?? session.tier;
  const matrixTier = mapIntakeTierToMatrixTier(effectiveTier);
  const isRevalidation = Boolean(session.validation_id);

  await updateBlueprintErectorState(
    session.blueprint_id,
    isRevalidation ? "REVALIDATION_RUNNING" : "VALIDATION_RUNNING",
  );

  const runNumber = await getRunNumber(userId);

  const pipeline = await runErectorValidationPipeline({
    sessionId,
    profileId: profile.id,
    userId,
  });

  const classification = await loadClassification(pipeline.validation_run_id);
  const loadedRulePack = classification
    ? await loadArchetypeRulePack(classification.primary_archetype, effectiveTier)
    : null;

  const finalVerdict: FinalVerdictDecision = {
    verdict: pipeline.verdict,
    recommended_path: recommendedPathForVerdict(pipeline.verdict),
    reasoning: [],
    correction_fields: pipeline.rule_results.rules_fired.includes("VR-010")
      ? ["demand_proof"]
      : [],
    requires_correction: pipeline.verdict !== "PROCEED",
    hard_blockers: pipeline.rule_results.hard_blockers,
    soft_warnings: pipeline.rule_results.soft_warnings,
  };

  const paths = generateThreePaths(profile, pipeline.scores, finalVerdict, loadedRulePack);

  await db
    .update(erectorValidationRuns)
    .set({
      path_current: pathObjectToValidationPayload(paths.current),
      path_adjusted: pathObjectToValidationPayload(paths.adjusted),
      path_alternative: pathObjectToValidationPayload(paths.alternative),
      run_number: runNumber,
      blueprint_id: session.blueprint_id ?? undefined,
    })
    .where(eq(erectorValidationRuns.id, pipeline.validation_run_id));

  let launchContractId: string | null = null;
  if (finalVerdict.verdict === "PROCEED" && session.blueprint_id) {
    launchContractId = await createBlueprintLaunchContract({
      userId,
      blueprintId: session.blueprint_id,
      validationRunId: pipeline.validation_run_id,
      classificationId: classification?.id ?? null,
      profile,
      finalVerdict,
      archetypeId: classification?.primary_archetype ?? loadedRulePack?.archetype_id ?? "direct_service_delivery",
      tier: effectiveTier,
      auditId,
      hardBlockers: finalVerdict.hard_blockers,
      softWarnings: finalVerdict.soft_warnings,
    });
  }

  if (finalVerdict.verdict === "ADJUST") {
    await createCorrectionFlow({
      userId,
      sessionId,
      blueprintId: session.blueprint_id,
      validationRunId: pipeline.validation_run_id,
      finalVerdict,
      ruleResults: pipeline.rule_results,
      auditId,
    });
  } else if (session.blueprint_id) {
    await updateBlueprintErectorState(session.blueprint_id, "VERDICT_ISSUED");
  }

  await writeOrchestratorAudit({
    auditId,
    userId,
    validationRunId: pipeline.validation_run_id,
    scores: pipeline.scores,
    ruleResults: pipeline.rule_results,
    finalVerdict,
    explanationId: pipeline.explanation_id,
  });

  if (session.blueprint_id) {
    await db
      .update(blueprints)
      .set({ erector_validation_id: pipeline.validation_run_id })
      .where(eq(blueprints.id, session.blueprint_id));
  }

  const requiresSimulation = matrixTier !== "starter" && finalVerdict.verdict === "PROCEED";

  return {
    validation_run_id: pipeline.validation_run_id,
    verdict: finalVerdict.verdict,
    verdict_confidence: verdictConfidence(finalVerdict.verdict),
    selected_path: null,
    paths,
    archetype: classification?.primary_archetype ?? loadedRulePack?.archetype_id ?? "direct_service_delivery",
    scores: pipeline.scores,
    hard_blockers: finalVerdict.hard_blockers,
    soft_warnings: finalVerdict.soft_warnings,
    correction_required: finalVerdict.verdict !== "PROCEED",
    explanation_id: pipeline.explanation_id,
    launch_contract_id: launchContractId,
    requires_simulation: requiresSimulation,
  };
}
