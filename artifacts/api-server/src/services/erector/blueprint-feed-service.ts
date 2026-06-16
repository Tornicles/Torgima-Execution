/**
 * DOC B4b — Maps Erector paid validation output into existing blueprint activation.
 */
import { randomUUID } from "node:crypto";
import { db, blueprints, erectorPaidValidations, erectorIntakeSessions, users, validations, erectorBlueprintLaunchContracts, erectorValidationRuns, erectorUserRealityProfiles, blueprintPolicies, erectorCapabilityProfiles, erectorPhaseGates, phases } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { BlueprintEngine } from "../../engines/blueprint/BlueprintEngine.js";
import { ensureBlueprintSelectionBeforeActivate } from "../../lib/ensureBlueprintSelectionBeforeActivate.js";
import { transitionBlueprintToPathSelection } from "../../lib/transitionBlueprintToPathSelection.js";
import { TorgimaError } from "../../lib/errors.js";
import { invalidateDashboardCache } from "../dashboard-cache.js";
import type { BlueprintTier } from "../../engines/blueprint/infrastructure/blueprint-types.js";
import { ErectorValidationStage, ValidationKind, ValidationStatus } from "@workspace/state-machine";
import { EVENT_TYPES, writeEvent } from "../EventService.js";

type GoalStructured = { cleaned_goal?: string; measurable_outcome?: string; feasibility_note?: string };
type PurposeStructured = { problem?: string; target_user?: string; change?: string; value?: string };

export async function feedErectorToBlueprint(
  validationId: string,
  userId: string,
  tier: string = "starter",
): Promise<{ id: string }> {
  const [validation] = await db
    .select()
    .from(erectorPaidValidations)
    .where(and(eq(erectorPaidValidations.id, validationId), eq(erectorPaidValidations.user_id, userId)))
    .limit(1);

  if (!validation) {
    throw new TorgimaError("NOT_FOUND", "VALIDATION_NOT_FOUND");
  }
  if (validation.blueprint_created && validation.blueprint_id) {
    return { id: validation.blueprint_id };
  }

  const goalStructured = (validation.goal_structured ?? {}) as GoalStructured;
  const purposeStructured = (validation.purpose_structured ?? {}) as PurposeStructured;
  const goal = goalStructured.cleaned_goal || validation.project_name || "Project execution goal";
  const purpose = purposeStructured.problem || purposeStructured.value || validation.project_name || goal;
  const parsedTier = (["starter", "growth", "ultimate"].includes(tier) ? tier : "starter") as BlueprintTier;
  const selectedPath =
    validation.selected_path === "current" ||
    validation.selected_path === "adjusted" ||
    validation.selected_path === "alternative"
      ? validation.selected_path
      : "adjusted";

  const blueprintEngine = new BlueprintEngine();
  const { blueprintId } = await blueprintEngine.createDraft(userId, {
    goal,
    purpose,
    domainHint: validation.industry ?? undefined,
    commitmentLevel: "high",
  });

  const [session] = validation.intake_json
    ? await db
        .select({ id: erectorIntakeSessions.id })
        .from(erectorIntakeSessions)
        .where(eq(erectorIntakeSessions.validation_id, validationId))
        .limit(1)
    : [null];

  await db
    .update(blueprints)
    .set({
      project_name: validation.project_name,
      goal_final: goal,
      purpose_final: purpose,
      domain_hint: validation.industry,
      domain: validation.industry,
      tier: parsedTier,
      selected_blueprint_level: parsedTier,
      blueprint_tier: parsedTier,
      mode: "individual",
      selected_path: selectedPath,
      timeframe_end: validation.timeline_final ? new Date(validation.timeline_final) : null,
      blueprint_source: "erector_authenticated",
      erector_intake_session_id: session?.id ?? null,
      validation_verdict: validation.verdict,
      reality_score: validation.validation_score,
      metadata: {
        policy_rules: validation.policy_rules ?? [],
        risk_flags: validation.risk_flags ?? [],
        winning_conditions: validation.winning_conditions ?? [],
        failure_conditions: validation.failure_conditions ?? [],
        erector_paid_validation_id: validationId,
      },
      updated_at: new Date(),
    })
    .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)));

  const contractId = randomUUID();

  const [validationRow] = await db
    .insert(validations)
    .values({
      blueprint_id: blueprintId,
      user_id: userId,
      contract_id: contractId,
      goal_final: goal,
      purpose_final: purpose,
      raw_goal: goal,
      raw_purpose: purpose,
      verdict: validation.verdict as "proceed" | "adjust" | "pivot" | null,
      overall_score: validation.validation_score,
      validation_kind: ValidationKind.ERECTOR,
      status: ValidationStatus.COMPLETE,
      validation_stage: ValidationStatus.COMPLETE,
      erector_validation_stage: ErectorValidationStage.COMPLETE,
      selected_path: selectedPath,
      selected_path_type: selectedPath,
      selected_blueprint_tier: parsedTier,
      is_finalized: true,
      finalized_at: new Date(),
      handoff_package: {
        goal_final: goal,
        purpose_final: purpose,
        erector_paid_validation_id: validationId,
      },
      intelligence: validation.report_json,
      country: validation.location,
    } as never)
    .returning();

  if (!validationRow) {
    throw new TorgimaError("INTERNAL_ERROR", "Failed to create validation for blueprint feed");
  }

  await ensureBlueprintSelectionBeforeActivate(blueprintId, userId, {
    tier: parsedTier,
    mode: "individual",
  });

  await transitionBlueprintToPathSelection({
    blueprintId,
    userId,
    validationId: validationRow.id,
    verdict: validation.verdict,
    selectedPath,
    realityScore: validation.validation_score,
    intelligencePayload: (validation.report_json as Record<string, unknown> | null) ?? null,
    validationKind: ValidationKind.ERECTOR,
  }).catch(() => null);

  await blueprintEngine.activateBlueprint(blueprintId, userId, validationRow.contract_id);

  await db
    .update(blueprints)
    .set({ blueprint_source: "erector_authenticated" })
    .where(eq(blueprints.id, blueprintId));

  await db
    .update(users)
    .set({ dashboard_mode: "full", erector_tier: "authenticated" })
    .where(eq(users.id, userId));

  if (session?.id) {
    await db
      .update(erectorIntakeSessions)
      .set({ status: "completed", completed_at: new Date(), last_saved_at: new Date() })
      .where(eq(erectorIntakeSessions.id, session.id));
  }

  await db
    .update(erectorPaidValidations)
    .set({
      blueprint_id: blueprintId,
      blueprint_created: true,
      status: "blueprint_linked",
    })
    .where(eq(erectorPaidValidations.id, validationId));

  invalidateDashboardCache(userId);

  return { id: blueprintId };
}

function skillToCapabilityId(skill: string): string {
  const normalized = skill.trim().toLowerCase().replace(/\s+/g, "-");
  if (normalized.startsWith("cap-")) return normalized;
  return `CAP-${normalized}-01`;
}

export async function injectErectorIntelligence(
  blueprintId: string,
  contractId: string,
  userId: string,
): Promise<void> {
  const [contract] = await db
    .select()
    .from(erectorBlueprintLaunchContracts)
    .where(eq(erectorBlueprintLaunchContracts.id, contractId))
    .limit(1);

  if (!contract) return;

  const policyRules = contract.policy_rules ?? [];
  const policyDont = contract.policy_dont ?? [];

  if (policyRules.length > 0 || policyDont.length > 0) {
    await db.insert(blueprintPolicies).values({
      blueprint_id: blueprintId,
      user_id: userId,
      focus_statement: policyRules[0] ?? null,
      anti_focus: policyDont[0] ?? null,
      rules: [...policyRules, ...policyDont.map((rule) => `avoid:${rule}`)],
      enforcement_level: "strict",
      generated_from: {
        source: "erector_launch_contract",
        contract_id: contractId,
      },
      active: true,
    });
  }

  await db
    .update(blueprints)
    .set({
      erector_archetype: contract.economic_archetype,
      erector_launch_contract_id: contractId,
      metadata: {
        winning_conditions: contract.winning_conditions ?? [],
        failure_conditions: contract.failure_conditions ?? [],
        risk_flags: contract.risk_flags ?? [],
        erector_launch_contract_id: contractId,
      },
    })
    .where(eq(blueprints.id, blueprintId));

  const [run] = contract.validation_run_id
    ? await db
        .select({ reality_profile_id: erectorValidationRuns.reality_profile_id })
        .from(erectorValidationRuns)
        .where(eq(erectorValidationRuns.id, contract.validation_run_id))
        .limit(1)
    : [null];

  if (run?.reality_profile_id) {
    const [profile] = await db
      .select({ skills_missing: erectorUserRealityProfiles.skills_missing })
      .from(erectorUserRealityProfiles)
      .where(eq(erectorUserRealityProfiles.id, run.reality_profile_id))
      .limit(1);

    for (const skill of profile?.skills_missing ?? []) {
      const capabilityId = skillToCapabilityId(skill);
      await db
        .insert(erectorCapabilityProfiles)
        .values({
          user_id: userId,
          blueprint_id: blueprintId,
          capability_id: capabilityId,
          proof_level: "none",
          proof_count: 0,
          capability_signal: 0,
          signal_confidence: "LOW",
        })
        .onConflictDoNothing();
    }
  }

  const requiredGates = Array.isArray(contract.required_phase_gates)
    ? (contract.required_phase_gates as Array<{ id?: string; label?: string; phase?: string }>)
    : [];

  const [currentPhase] = await db
    .select({ id: phases.id, name: phases.name })
    .from(phases)
    .where(and(eq(phases.blueprint_id, blueprintId), eq(phases.is_active, true)))
    .limit(1);

  for (const gate of requiredGates) {
    if (!currentPhase) break;
    await db.insert(erectorPhaseGates).values({
      user_id: userId,
      blueprint_id: blueprintId,
      phase_id: currentPhase.id,
      phase_name: gate.phase ?? currentPhase.name,
      archetype: contract.economic_archetype,
      gate_criteria: { template_id: gate.id ?? gate.label ?? "required_gate" },
      readiness_score: 0,
      gate_result: "TEMPLATE",
      blocking_reasons: gate.label ? [gate.label] : [],
    });
  }

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_INTELLIGENCE_INJECTED,
    entityType: "blueprint",
    entityId: blueprintId,
    userId,
    blueprintId,
    payload: {
      contract_id: contractId,
      archetype: contract.economic_archetype,
      policy_rule_count: policyRules.length,
      phase_gate_templates: requiredGates.length,
    },
    idempotencyKey: `erector_intelligence_injected:${blueprintId}:${contractId}`,
  }).catch(() => null);
}
