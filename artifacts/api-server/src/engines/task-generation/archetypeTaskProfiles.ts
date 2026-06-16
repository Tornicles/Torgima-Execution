import { and, eq, sql } from "drizzle-orm";
import { blueprintPolicies, blueprints, db, orders } from "@workspace/db";
import { loadArchetypeRulePack, getTaskProfile } from "../erector/economic/ArchetypeRulePackLoader.js";
import type { ArchetypeRulePack } from "../erector/economic/types.js";

export type BlueprintPhaseBucket = "foundation" | "growth" | "operations";

export interface ArchetypeTaskOverride {
  action_type: string;
  proof_type: string;
  proof_description: string;
  why_it_matters: string;
}

export interface ArchetypeContext {
  archetype: string;
  core_risk: string;
  foundation_proof_required: string[];
  false_progress_patterns: string[];
  current_phase: BlueprintPhaseBucket | null;
  policy_rules: string[];
  winning_conditions: string[];
  failure_conditions: string[];
}

export const ARCHETYPE_FOUNDATION_PRIORITIES: Record<string, ArchetypeTaskOverride> = {
  marketplace_exchange: {
    action_type: "demand_mapping",
    proof_type: "TEXT",
    proof_description:
      "List of 5 potential buyers and 5 potential sellers with contact evidence",
    why_it_matters: "A marketplace with one side is not a marketplace.",
  },
  direct_service_delivery: {
    action_type: "offer_creation",
    proof_type: "TEXT",
    proof_description:
      "Your offer: who it is for, what you deliver, your price, your timeline",
    why_it_matters: "A direct service business launches with a client, not a website.",
  },
  saas_platform: {
    action_type: "problem_interview",
    proof_type: "TEXT",
    proof_description:
      "Notes from 3+ conversations describing the painful workflow in the user's own words",
    why_it_matters: "SaaS fails when it solves a problem users do not actively feel.",
  },
  content_media: {
    action_type: "audience_building",
    proof_type: "LINK",
    proof_description: "Email list export or subscriber confirmation showing 20+ subscribers",
    why_it_matters: "Content without an owned audience is rented attention.",
  },
  consulting_advisory: {
    action_type: "positioning",
    proof_type: "TEXT",
    proof_description:
      "Written offer with problem, client profile, outcome, and price",
    why_it_matters: "Advisory businesses win on clarity of positioning before scale.",
  },
  information_knowledge_product: {
    action_type: "audience_validation",
    proof_type: "LINK",
    proof_description: "Waitlist or pre-sale evidence from at least 50 interested people",
    why_it_matters: "Information products fail when built before audience demand is proven.",
  },
  subscription_recurring: {
    action_type: "core_value_pilot",
    proof_type: "TEXT",
    proof_description: "Evidence of 3 users paying monthly for at least 60 days",
    why_it_matters: "Recurring revenue depends on a single repeating value users renew for.",
  },
  physical_product_inventory: {
    action_type: "margin_test",
    proof_type: "TEXT",
    proof_description: "Receipt showing sale at target price with positive net margin",
    why_it_matters: "Physical products fail when margin is assumed instead of measured.",
  },
  social_enterprise_mission: {
    action_type: "beneficiary_validation",
    proof_type: "TEXT",
    proof_description: "Documented outcome for at least 1 beneficiary and funding commitment",
    why_it_matters: "Mission ventures must prove impact before scaling programs.",
  },
  collective_community: {
    action_type: "founding_members",
    proof_type: "TEXT",
    proof_description: "20 founding members with 40%+ participation at the first event",
    why_it_matters: "Communities start with engaged founding members, not empty platforms.",
  },
};

export const ARCHETYPE_GROWTH_PRIORITIES: Record<string, Pick<ArchetypeTaskOverride, "action_type" | "why_it_matters">> = {
  direct_service_delivery: {
    action_type: "delivery_systematization",
    why_it_matters: "Service businesses scale by systematizing delivery, not just getting more clients.",
  },
  saas_platform: {
    action_type: "retention_measurement",
    why_it_matters: "SaaS growth depends on retention. Churn destroys revenue before it compounds.",
  },
  content_media: {
    action_type: "owned_channel_migration",
    why_it_matters: "Platform dependency is the content creator's biggest risk. Own your audience.",
  },
};

export function normalizeBlueprintPhaseBucket(
  phaseName: string | null | undefined,
  planName?: string | null,
): BlueprintPhaseBucket | null {
  const combined = `${phaseName ?? ""} ${planName ?? ""}`.toLowerCase();
  if (combined.includes("foundation") || combined.includes("setup")) return "foundation";
  if (combined.includes("growth") || combined.includes("scale")) return "growth";
  if (combined.includes("operation") || combined.includes("validation")) return "operations";
  return null;
}

function parsePolicyRules(rules: unknown): string[] {
  if (!Array.isArray(rules)) return [];
  return rules.map((rule) => String(rule)).filter(Boolean);
}

function parseMetadataConditions(
  metadata: Record<string, unknown> | null | undefined,
  key: "winning_conditions" | "failure_conditions",
): string[] {
  if (!metadata || !Array.isArray(metadata[key])) return [];
  return (metadata[key] as unknown[]).map((item) => String(item)).filter(Boolean);
}

export async function loadArchetypeContext(
  blueprint: Pick<
    typeof blueprints.$inferSelect,
    "id" | "erector_archetype" | "erector_launch_contract_id" | "tier" | "metadata"
  >,
  phaseName?: string | null,
  planName?: string | null,
): Promise<ArchetypeContext | null> {
  if (!blueprint.erector_archetype || !blueprint.erector_launch_contract_id) {
    return null;
  }

  const rulePack = await loadArchetypeRulePack(blueprint.erector_archetype, blueprint.tier ?? "growth");
  if (!rulePack) return null;

  const taskProfile = getTaskProfile(rulePack);

  const [policyRow] = await db
    .select({
      focus_statement: blueprintPolicies.focus_statement,
      anti_focus: blueprintPolicies.anti_focus,
      rules: blueprintPolicies.rules,
    })
    .from(blueprintPolicies)
    .where(
      and(eq(blueprintPolicies.blueprint_id, blueprint.id), eq(blueprintPolicies.active, true)),
    )
    .limit(1);

  const policyRules = [
    policyRow?.focus_statement,
    policyRow?.anti_focus,
    ...parsePolicyRules(policyRow?.rules),
  ].filter((rule): rule is string => Boolean(rule));

  const metadata = (blueprint.metadata ?? {}) as Record<string, unknown>;

  return {
    archetype: blueprint.erector_archetype,
    core_risk: taskProfile.core_risk,
    foundation_proof_required: taskProfile.foundation_proof_required,
    false_progress_patterns: taskProfile.false_progress_patterns,
    current_phase: normalizeBlueprintPhaseBucket(phaseName, planName),
    policy_rules: policyRules,
    winning_conditions: parseMetadataConditions(metadata, "winning_conditions"),
    failure_conditions: parseMetadataConditions(metadata, "failure_conditions"),
  };
}

export function getArchetypeProfileForPhase(
  archetype: string,
  phase: BlueprintPhaseBucket | null,
): ArchetypeTaskOverride | null {
  if (phase === "foundation") {
    return ARCHETYPE_FOUNDATION_PRIORITIES[archetype] ?? null;
  }
  if (phase === "growth") {
    const growth = ARCHETYPE_GROWTH_PRIORITIES[archetype];
    if (!growth) return null;
    const foundation = ARCHETYPE_FOUNDATION_PRIORITIES[archetype];
    return {
      action_type: growth.action_type,
      proof_type: foundation?.proof_type ?? "TEXT",
      proof_description: foundation?.proof_description ?? "Evidence of progress toward growth milestone",
      why_it_matters: growth.why_it_matters,
    };
  }
  return null;
}

export async function checkIfPriorityTaskCompleted(
  blueprintId: string,
  userId: string,
  priorityActionType: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.blueprint_id, blueprintId),
        eq(orders.user_id, userId),
        eq(orders.status, "completed"),
        sql`${orders.trace_metadata}->>'archetype_priority_action' = ${priorityActionType}`,
      ),
    )
    .limit(1);

  return Boolean(row);
}

export async function resolveArchetypeTaskOverride(
  archetypeContext: ArchetypeContext,
  blueprintId: string,
  userId: string,
  force = false,
): Promise<ArchetypeTaskOverride | null> {
  const profile = getArchetypeProfileForPhase(
    archetypeContext.archetype,
    archetypeContext.current_phase,
  );
  if (!profile) return null;

  if (!force) {
    const completed = await checkIfPriorityTaskCompleted(
      blueprintId,
      userId,
      profile.action_type,
    );
    if (completed) return null;
  }

  return profile;
}

export function isArchetypeFalseProgressRisk(
  proposedTaskType: string,
  archetypeContext: ArchetypeContext,
): boolean {
  const normalized = proposedTaskType.toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return false;

  return archetypeContext.false_progress_patterns.some((pattern) => {
    const p = pattern.toLowerCase().replace(/\s+/g, "_");
    return p.includes(normalized) || normalized.includes(p);
  });
}

export function formatArchetypeActionName(actionType: string): string {
  return actionType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function applyArchetypeTaskOverride<T extends {
  title: string;
  instruction: string;
  expected_output: string;
  definition_of_done: string;
  why_it_matters: string;
  time_estimate_minutes: number;
  proof_required?: boolean;
  proof_type?: string;
  proof_description?: string;
}>(
  content: T,
  override: ArchetypeTaskOverride,
  goal: string,
): T & { proof_required?: boolean; proof_type?: string; proof_description?: string } {
  const actionLabel = formatArchetypeActionName(override.action_type);
  return {
    ...content,
    title: `${actionLabel}: ${content.title.split(":").pop()?.trim() ?? "Priority Action"}`,
    instruction: `${content.instruction}\n\nArchetype priority (${override.action_type}): complete this with proof — ${override.proof_description}\n\nGoal: "${goal.slice(0, 180)}"`,
    why_it_matters: override.why_it_matters,
    proof_required: true,
    proof_type: override.proof_type.toLowerCase(),
    proof_description: override.proof_description,
  };
}

export function buildBhudhiArchetypeFacts(
  archetypeContext: ArchetypeContext | null,
  override: ArchetypeTaskOverride | null,
  effectiveActionType: string,
): Record<string, unknown> {
  if (!archetypeContext) return {};

  return {
    action_type: effectiveActionType,
    erector_archetype: archetypeContext.archetype,
    archetype_core_risk: archetypeContext.core_risk,
    proof_standard: override?.proof_description ?? null,
    why_it_matters_override: override?.why_it_matters ?? null,
    policy_rules: archetypeContext.policy_rules.slice(0, 3),
    winning_conditions: archetypeContext.winning_conditions.slice(0, 2),
  };
}

export type { ArchetypeRulePack };
