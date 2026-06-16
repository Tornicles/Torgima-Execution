import type { DecisionAuditRecord } from "./DecisionAuditService.js";
import { mapIntakeTierToMatrixTier } from "../../engines/erector/ValidationScoringEngine.js";

export const TIER_PERMISSIONS = {
  starter: {
    validation_depth: "basic",
    simulation_allowed: false,
    scenario_access: false,
    framework_vetoes: [] as string[],
    academy_content_depth: "basic",
    resimulation_access: false,
    audit_visibility: "summary",
    phase_gates: "simple",
  },
  growth: {
    validation_depth: "full",
    simulation_allowed: true,
    scenario_access: false,
    framework_vetoes: ["customer_value_x", "governance_risk_x"],
    academy_content_depth: "full",
    resimulation_access: true,
    audit_visibility: "summary",
    phase_gates: "archetype_standard",
  },
  ultimate: {
    validation_depth: "full",
    simulation_allowed: true,
    scenario_access: true,
    framework_vetoes: [
      "strategy_core_x",
      "customer_value_x",
      "synergy_ops_x",
      "governance_risk_x",
    ],
    academy_content_depth: "advanced",
    resimulation_access: true,
    audit_visibility: "full",
    phase_gates: "archetype_strict",
  },
} as const;

export type TierKey = keyof typeof TIER_PERMISSIONS;
export type TierFeature = keyof (typeof TIER_PERMISSIONS)["starter"];

export function normalizeTierKey(tier: string): TierKey {
  const matrix = mapIntakeTierToMatrixTier(tier);
  return matrix;
}

export function hasPermission(tier: string, feature: TierFeature) {
  const key = normalizeTierKey(tier);
  return TIER_PERMISSIONS[key][feature];
}

export function assertTierPermission(
  tier: string,
  feature: TierFeature,
): { allowed: boolean; reason?: string } {
  const value = hasPermission(tier, feature);
  if (feature === "simulation_allowed" && value === false) {
    return { allowed: false, reason: "Simulation is not available on your plan." };
  }
  if (feature === "scenario_access" && value === false) {
    return { allowed: false, reason: "Full scenario view requires Ultimate tier." };
  }
  if (feature === "resimulation_access" && value === false) {
    return { allowed: false, reason: "Resimulation is not available on your plan." };
  }
  if (typeof value === "boolean" && !value) {
    return { allowed: false, reason: "This feature is not available on your plan." };
  }
  return { allowed: true };
}

export function filterAuditRecordForTier(
  tier: string,
  record: DecisionAuditRecord,
):
  | DecisionAuditRecord
  | Pick<DecisionAuditRecord, "decision_id" | "decision_type" | "result" | "created_at"> {
  if (hasPermission(tier, "audit_visibility") === "full") {
    return record;
  }
  return {
    decision_id: record.decision_id,
    decision_type: record.decision_type,
    result: record.result,
    created_at: record.created_at,
  } as Pick<DecisionAuditRecord, "decision_id" | "decision_type" | "result" | "created_at">;
}
