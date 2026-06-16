import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  blueprints,
  db,
  erectorArchetypeClassifications,
  erectorBlueprintLaunchContracts,
  erectorCorrectionPaths,
  erectorDecisionAudits,
  erectorSimulationRuns,
  erectorUserRealityProfiles,
  erectorValidationRuns,
} from "@workspace/db";
import { EVENT_TYPES, writeEvent } from "../../../services/EventService.js";
import { loadArchetypeRulePack } from "../economic/ArchetypeRulePackLoader.js";
import { updateBlueprintErectorState } from "../erectorStateMachine.js";
import { setLaunchContractPermitted } from "../LaunchContractEnforcer.js";
import { mapIntakeTierToMatrixTier } from "../ValidationScoringEngine.js";
import { evaluateFrameworkVetoes } from "./FrameworkVetoEvaluator.js";
import { generateScenarios } from "./ScenarioGenerator.js";
import { calculateSimulationScores } from "./SimulationScoringEngine.js";
import type { SimulationOrchestratorResult } from "./types.js";

export async function runSimulationOrchestrator(
  validationRunId: string,
  userId: string,
  blueprintId: string,
  tier: string,
): Promise<SimulationOrchestratorResult> {
  const matrixTier = mapIntakeTierToMatrixTier(tier);
  if (matrixTier === "starter") {
    throw new Error("SIMULATION_NOT_REQUIRED_FOR_STARTER");
  }

  const [run] = await db
    .select()
    .from(erectorValidationRuns)
    .where(
      and(eq(erectorValidationRuns.id, validationRunId), eq(erectorValidationRuns.user_id, userId)),
    )
    .limit(1);

  if (!run) throw new Error("Validation run not found");

  const [classification] = await db
    .select()
    .from(erectorArchetypeClassifications)
    .where(eq(erectorArchetypeClassifications.validation_run_id, validationRunId))
    .limit(1);

  const archetypeId = classification?.primary_archetype ?? "direct_service_delivery";

  let profile = null as typeof erectorUserRealityProfiles.$inferSelect | null;
  if (run.reality_profile_id) {
    const [loaded] = await db
      .select()
      .from(erectorUserRealityProfiles)
      .where(eq(erectorUserRealityProfiles.id, run.reality_profile_id))
      .limit(1);
    profile = loaded ?? null;
  }
  if (!profile && run.intake_session_id) {
    const [loaded] = await db
      .select()
      .from(erectorUserRealityProfiles)
      .where(
        and(
          eq(erectorUserRealityProfiles.intake_session_id, run.intake_session_id),
          eq(erectorUserRealityProfiles.user_id, userId),
        ),
      )
      .orderBy(desc(erectorUserRealityProfiles.created_at))
      .limit(1);
    profile = loaded ?? null;
  }
  if (!profile) throw new Error("Reality profile not found");

  const rulePack = await loadArchetypeRulePack(archetypeId, matrixTier);
  if (!rulePack) throw new Error(`Archetype rule pack not found: ${archetypeId}`);

  await updateBlueprintErectorState(blueprintId, "SIMULATION_RUNNING");

  const scoringInput = {
    profile,
    rulePack,
    tier: matrixTier,
    demandProofClass: run.demand_proof_class ?? 0,
    marketViabilityScore: run.market_viability_score ?? 0,
    feasibilityRating: run.feasibility_rating,
    payingForAlternatives: null,
    selectedPath: run.selected_path,
  };

  const scores = calculateSimulationScores(scoringInput);
  const scenarios = generateScenarios(scores, profile, rulePack);
  const frameworkVerdicts = evaluateFrameworkVetoes(scoringInput, matrixTier);
  const hardVetoActive = frameworkVerdicts.some((v) => v.veto_type === "HARD_VETO");
  const auditId = randomUUID();

  const hardVetoes = frameworkVerdicts
    .filter((v) => v.veto_type === "HARD_VETO")
    .map((v) => v.framework_id);
  const softRisks = frameworkVerdicts
    .filter((v) => v.veto_type === "SOFT_VETO")
    .map((v) => v.framework_id);

  const [simRun] = await db
    .insert(erectorSimulationRuns)
    .values({
      user_id: userId,
      validation_run_id: validationRunId,
      blueprint_id: blueprintId,
      archetype_classification_id: classification?.id ?? null,
      tier: matrixTier,
      primary_archetype: archetypeId,
      secondary_archetype: classification?.secondary_archetype ?? null,
      archetype_confidence: classification?.classification_confidence ?? "0.70",
      probability_proceed: scores.probability_proceed,
      probability_adjust: scores.probability_adjust,
      probability_failure: scores.probability_failure,
      simulation_confidence: scores.simulation_confidence,
      best_case_description: scenarios.best_case.description,
      best_case_probability: scenarios.best_case.probability,
      best_case_timeline_adj: scenarios.best_case.timeline_adj,
      best_case_conditions: scenarios.best_case.conditions,
      best_case_risks: scenarios.best_case.risks,
      best_case_warning_triggers: scenarios.best_case.warning_triggers,
      base_case_description: scenarios.base_case.description,
      base_case_probability: scenarios.base_case.probability,
      base_case_timeline_adj: scenarios.base_case.timeline_adj,
      base_case_risks: scenarios.base_case.risks,
      base_case_blockers: scenarios.base_case.blockers,
      downside_description: scenarios.downside.description,
      downside_probability: scenarios.downside.probability,
      downside_timeline_adj: scenarios.downside.timeline_adj,
      downside_failure_modes: scenarios.downside.failure_modes,
      downside_correction_path: scenarios.downside.correction_path,
      economic_constraints: scores.economic_constraints,
      civilization_constraints: scores.civilization_constraints,
      framework_verdicts: frameworkVerdicts,
      hard_vetoes: hardVetoes,
      soft_risks: softRisks,
      veto_active: hardVetoActive,
      veto_frameworks: hardVetoes,
      veto_reasons: frameworkVerdicts
        .filter((v) => v.veto_type === "HARD_VETO")
        .map((v) => v.user_visible_reason),
      recommended_path: run.selected_path ?? "current",
      verdict: hardVetoActive ? "BLOCKED" : "PERMITTED",
      status: "completed",
      completed_at: new Date(),
    })
    .returning({ id: erectorSimulationRuns.id });

  if (!simRun) throw new Error("Failed to write simulation run");

  await db
    .update(blueprints)
    .set({ erector_simulation_id: simRun.id })
    .where(eq(blueprints.id, blueprintId));

  if (hardVetoActive) {
    await updateBlueprintErectorState(blueprintId, "LAUNCH_BLOCKED");
    await db.insert(erectorCorrectionPaths).values({
      user_id: userId,
      blueprint_id: blueprintId,
      validation_run_id: validationRunId,
      source_engine: "ErectorSimulationOrchestrator",
      source_id: simRun.id,
      correction_type: "PIVOT_REQUIRED",
      blocked_action: "blueprint_launch",
      reason: hardVetoes.join("; ") || "Simulation framework veto",
      user_visible_reason:
        frameworkVerdicts.find((v) => v.veto_type === "HARD_VETO")?.user_visible_reason ??
        "Simulation blocked launch due to framework veto.",
      required_actions: frameworkVerdicts
        .filter((v) => v.veto_type === "HARD_VETO" && v.correction_required)
        .map((v) => v.correction_required as string),
      required_evidence: [],
      revalidation_required: true,
      unblock_condition: "Resolve framework veto and re-run validation",
      audit_id: auditId,
    });
  } else {
    await updateBlueprintErectorState(blueprintId, "LAUNCH_PERMITTED");
    await setLaunchContractPermitted(blueprintId);
    await db
      .update(erectorBlueprintLaunchContracts)
      .set({
        simulation_run_id: simRun.id,
        simulation_summary: {
          probability_proceed: scores.probability_proceed,
          probability_adjust: scores.probability_adjust,
          probability_failure: scores.probability_failure,
          simulation_confidence: scores.simulation_confidence,
        },
        framework_verdicts: frameworkVerdicts,
      })
      .where(
        and(
          eq(erectorBlueprintLaunchContracts.validation_run_id, validationRunId),
          eq(erectorBlueprintLaunchContracts.consumed, false),
        ),
      );

    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_LAUNCH_PERMITTED,
      entityType: "erector_validation_run",
      entityId: validationRunId,
      userId,
      blueprintId,
      payload: {
        validation_run_id: validationRunId,
        simulation_run_id: simRun.id,
        selected_path: run.selected_path,
      },
      idempotencyKey: `erector_launch_permitted:${validationRunId}:simulation`,
    });
  }

  await db.insert(erectorDecisionAudits).values({
    decision_id: auditId,
    decision_type: hardVetoActive ? "simulation_blocked" : "simulation_completed",
    source_engine: "ErectorSimulationOrchestrator",
    user_id: userId,
    entity_type: "erector_simulation_run",
    entity_id: simRun.id,
    input_snapshot: {
      validation_run_id: validationRunId,
      archetype_id: archetypeId,
      tier: matrixTier,
      scores,
    },
    rules_applied: frameworkVerdicts.map((v) => v.framework_id),
    result: hardVetoActive ? "BLOCKED" : "PERMITTED",
    result_detail: {
      hard_vetoes: hardVetoes,
      probability_proceed: scores.probability_proceed,
    },
    explanation_id: null,
  });

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_SIMULATION_COMPLETED,
    entityType: "erector_simulation_run",
    entityId: simRun.id,
    userId,
    blueprintId,
    payload: {
      validation_run_id: validationRunId,
      simulation_run_id: simRun.id,
      verdict: hardVetoActive ? "BLOCKED" : "PERMITTED",
      probability_proceed: scores.probability_proceed,
      hard_veto_active: hardVetoActive,
    },
    idempotencyKey: `erector_simulation_completed:${simRun.id}`,
  });

  if (matrixTier === "ultimate" && scores.probability_proceed < 25 && !hardVetoActive) {
    await writeEvent({
      eventType: EVENT_TYPES.ERECTOR_RESIMULATION_WARNING,
      entityType: "erector_simulation_run",
      entityId: simRun.id,
      userId,
      blueprintId,
      payload: {
        reason: "low_probability_proceed",
        probability_proceed: scores.probability_proceed,
      },
      idempotencyKey: `erector_simulation_low_probability:${simRun.id}`,
    });
  }

  return {
    simulation_run_id: simRun.id,
    verdict: hardVetoActive ? "BLOCKED" : "PERMITTED",
    scores,
    scenarios,
    framework_verdicts: frameworkVerdicts,
  };
}
