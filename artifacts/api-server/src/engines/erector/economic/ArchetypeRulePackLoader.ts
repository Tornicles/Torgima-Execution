import { db, erectorArchetypeRulePacks } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { ArchetypeRulePack } from "./types.js";

const TIER_ADJUSTMENT_KEYS: Record<string, keyof typeof erectorArchetypeRulePacks.$inferSelect> = {
  starter: "starter_adjustments",
  growth: "growth_adjustments",
  ultimate: "ultimate_adjustments",
};

function mergeAdjustments(
  pack: typeof erectorArchetypeRulePacks.$inferSelect,
  tier: string,
): Record<string, unknown> {
  const key = TIER_ADJUSTMENT_KEYS[tier.toLowerCase()] ?? "starter_adjustments";
  const raw = pack[key];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function applyNumericOverride(
  base: number | null | undefined,
  adjustments: Record<string, unknown>,
  field: string,
): number | null {
  const val = adjustments[field];
  if (typeof val === "number") return val;
  return base ?? null;
}

export async function loadArchetypeRulePack(
  archetypeId: string,
  tier: string,
): Promise<ArchetypeRulePack | null> {
  const [pack] = await db
    .select()
    .from(erectorArchetypeRulePacks)
    .where(eq(erectorArchetypeRulePacks.archetype_id, archetypeId))
    .limit(1);

  if (!pack) return null;

  const tier_adjustments_applied = mergeAdjustments(pack, tier);

  const minimum_demand_proof_class =
    applyNumericOverride(
      pack.minimum_demand_proof_class,
      tier_adjustments_applied,
      "minimum_demand_proof_class",
    ) ?? pack.minimum_demand_proof_class;

  return {
    ...pack,
    minimum_demand_proof_class,
    tier_adjustments_applied,
  };
}

export function getMinimumDemandProofClass(pack: ArchetypeRulePack | null): number {
  return pack?.minimum_demand_proof_class ?? 3;
}

export interface ArchetypeTaskProfileFromPack {
  core_risk: string;
  foundation_proof_required: string[];
  false_progress_patterns: string[];
  demand_proof_description: string;
}

export function getTaskProfile(pack: ArchetypeRulePack): ArchetypeTaskProfileFromPack {
  return {
    core_risk: pack.core_risk,
    foundation_proof_required: pack.proof_required ?? [],
    false_progress_patterns: pack.false_progress_patterns ?? [],
    demand_proof_description: pack.proof_description,
  };
}
