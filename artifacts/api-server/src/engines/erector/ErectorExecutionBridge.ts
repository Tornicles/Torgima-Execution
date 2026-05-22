import { blueprints, db, orders, validationArchetypeMaps, validations } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { ArchetypeResolutionOutput } from "../../types/erector.js";
import { CONDITIONS } from "../../constants/conditions.js";
import { OrderStatus } from "@workspace/state-machine";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface FirstWeekPlanItem {
  title: string;
  action: string;
  expectedOutput: string;
  archetypeSpecific: string;
  smokeTest: boolean;
}

export interface LockedErectorIntel {
  realityScore: number | null;
  blueprintTier: string | null;
  primaryArchetypeId: string | null;
  industryState: string | null;
  archetypeExecutionMult: number;
  archetypeTimeframeMult: number;
  archetypeDifficultyAdj: number;
  validationId: string;
  selectedPath: string | null;
  firstWeekPlan: unknown;
}

export function applyArchetypeToTaskLimits(
  baseMin: number,
  baseMax: number,
  archetypeExecutionMult?: number | null,
): { min: number; max: number } {
  const execMult = archetypeExecutionMult ?? 1.0;
  return {
    min: Math.max(1, Math.round(baseMin * execMult)),
    max: Math.min(8, Math.round(baseMax * execMult)),
  };
}

export { archetypeSignalWindowDays } from "./ArchetypeExecutionContext.js";

export function extractLockedIntelFromValidation(
  row: typeof validations.$inferSelect,
  primaryArchetypeId?: string | null,
): LockedErectorIntel {
  const archetypeResolution = row.archetype_resolution as ArchetypeResolutionOutput | null;
  const primary = archetypeResolution?.primaryArchetype;
  const industry = (row.industry_intelligence as Record<string, unknown> | null) ?? {};
  const industryState = String(industry["industryState"] ?? industry["industry_state"] ?? "STABLE").toUpperCase();

  return {
    realityScore: row.reality_score ?? null,
    blueprintTier: row.recommended_blueprint_level ?? row.selected_blueprint_tier ?? null,
    primaryArchetypeId:
      primaryArchetypeId ??
      (primary?.id && !primary.id.startsWith("seed-") ? primary.id : null),
    industryState,
    archetypeExecutionMult:
      primary?.executionIntensityMultiplier ??
      archetypeResolution?.combinedExecutionIntensityMultiplier ??
      1.0,
    archetypeTimeframeMult:
      primary?.timeframePressureMultiplier ??
      archetypeResolution?.combinedTimeframePressureMultiplier ??
      1.0,
    archetypeDifficultyAdj: primary?.blueprintDifficultyAdjustment ?? 0,
    validationId: row.id,
    selectedPath: row.selected_path_type ?? row.selected_path ?? null,
    firstWeekPlan: row.first_week_plan,
  };
}

export function blueprintSetFromLockedIntel(intel: LockedErectorIntel): Partial<typeof blueprints.$inferInsert> {
  return {
    reality_score: intel.realityScore,
    blueprint_tier: intel.blueprintTier,
    chosen_blueprint_level: intel.blueprintTier,
    primary_archetype_id: intel.primaryArchetypeId,
    industry_state: intel.industryState,
    archetype_execution_mult: intel.archetypeExecutionMult,
    archetype_timeframe_mult: intel.archetypeTimeframeMult,
    archetype_difficulty_adj: intel.archetypeDifficultyAdj,
    erector_validation_id: intel.validationId,
  };
}

/** Normalize validation.first_week_plan (array or { days }) into 7 launch tasks. */
export function parseFirstWeekPlan(raw: unknown): FirstWeekPlanItem[] {
  if (!raw) return [];

  const withPlans = raw as { plans?: unknown[]; days?: unknown[] };
  if (Array.isArray(withPlans.plans) && withPlans.plans.length > 0) {
    return parseFirstWeekPlan(withPlans.plans);
  }

  if (Array.isArray(raw)) {
    return raw.slice(0, 7).map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        title: String(row.title ?? row.name ?? `Week 1 — Day ${index + 1}`),
        action: String(row.action ?? row.description ?? row.instruction ?? "Complete one verifiable smoke test."),
        expectedOutput: String(row.expectedOutput ?? row.expected_output ?? "Recorded proof of completion."),
        archetypeSpecific: String(row.archetypeSpecific ?? row.economyContext ?? row.archetype_specific ?? ""),
        smokeTest: row.smokeTest !== false && row.smoke_test !== false,
      };
    });
  }

  const days = (raw as { days?: Array<{ day?: number; actions?: Array<Record<string, unknown>> }> }).days;
  if (!Array.isArray(days)) return [];

  const items: FirstWeekPlanItem[] = [];
  for (const day of days) {
    const action = day.actions?.[0];
    if (!action) continue;
    items.push({
      title: String(action.title ?? `Day ${day.day ?? items.length + 1}`),
      action: String(action.description ?? action.title ?? "Complete smoke test."),
      expectedOutput: "Verifiable artifact or written proof.",
      archetypeSpecific: String(action.economyContext ?? ""),
      smokeTest: String(action.type ?? "execution") !== "recovery",
    });
    if (items.length >= 7) break;
  }
  return items;
}

export async function resolvePrimaryArchetypeId(
  tx: Tx,
  validationId: string,
  archetypeResolution: ArchetypeResolutionOutput | null,
): Promise<string | null> {
  const [mapRow] = await tx
    .select({ archetype_id: validationArchetypeMaps.archetype_id })
    .from(validationArchetypeMaps)
    .where(and(eq(validationArchetypeMaps.validation_id, validationId), eq(validationArchetypeMaps.is_primary, true)))
    .limit(1);

  if (mapRow?.archetype_id) return mapRow.archetype_id;

  const primary = archetypeResolution?.primaryArchetype;
  if (primary?.id && !primary.id.startsWith("seed-")) return primary.id;
  return null;
}

export async function seedErectorFirstWeekOrders(params: {
  tx: Tx;
  blueprintId: string;
  userId: string;
  enforcementPackageId: string | null;
  plan: FirstWeekPlanItem[];
  chain: { planId: string; phaseId: string };
  domain: string;
  tier: string;
}): Promise<number> {
  const { tx, blueprintId, userId, plan, chain, domain, tier } = params;
  if (plan.length === 0) return 0;

  const dueBase = new Date();
  let seeded = 0;

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i]!;
    const isSmoke = item.smokeTest;
    await tx.insert(orders).values({
      blueprint_id: blueprintId,
      user_id: userId,
      linked_plan_id: chain.planId,
      linked_phase_id: chain.phaseId,
      enforcement_package_id: params.enforcementPackageId,
      task_type: isSmoke ? "smoke_test" : "execution",
      title: item.title,
      instruction: item.action,
      expected_output: item.expectedOutput,
      definition_of_done: "Smoke test completed and outcome recorded.",
      context_why: item.archetypeSpecific || "Erector first-week reality check before full execution loop.",
      why_it_matters: item.archetypeSpecific || "Validates assumptions from economy-adjusted validation.",
      order_type: isSmoke ? "smoke_test" : "execution",
      proof_required: isSmoke,
      proof_type: isSmoke ? "text" : "none",
      proof_description: isSmoke ? "Submit proof that this smoke test is complete." : undefined,
      difficulty: "easy",
      priority: i + 1,
      domain: domain as typeof orders.$inferInsert["domain"],
      condition_at_generation: CONDITIONS.NOTHINGNESS,
      domain_at_generation: domain,
      generation_reason: "erector_first_week_seed",
      assigned_member_id: userId,
      status: i === 0 ? OrderStatus.PENDING : OrderStatus.PRE_GENERATED,
      due_at: new Date(dueBase.getTime() + i * 86400000),
      due_date: new Date(dueBase.getTime() + i * 86400000),
      time_estimate_minutes: tier === "starter" ? 30 : 45,
      time_estimate_mins: tier === "starter" ? 30 : 45,
      command_context: {
        source: "erector_first_week_seed",
        dayIndex: i + 1,
        smokeTest: isSmoke,
      },
      trace_metadata: {
        layer: "order",
        generationReason: "erector_first_week_seed",
        smokeTest: isSmoke,
      },
    });
    seeded++;
  }

  return seeded;
}

export async function loadValidationForLaunch(
  tx: Tx,
  blueprintId: string,
  validationContractId: string,
): Promise<(typeof validations.$inferSelect) | null> {
  const [byContract] = await tx
    .select()
    .from(validations)
    .where(eq(validations.contract_id, validationContractId))
    .limit(1);
  if (byContract && byContract.blueprint_id === blueprintId) return byContract;

  const [latest] = await tx
    .select()
    .from(validations)
    .where(eq(validations.blueprint_id, blueprintId))
    .orderBy(desc(validations.created_at))
    .limit(1);
  return latest ?? null;
}
