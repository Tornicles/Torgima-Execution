/**
 * Blueprint Tier System — canonical tier behavior (Schema doc §4.4).
 * Immutable at runtime; snapshotted to blueprints.tier_config at generation.
 */

import type { BlueprintTier } from "./infrastructure/blueprint-types.js";

export type TierPhaseMode = "linear" | "gated" | "adaptive";
export type TierTaskStyle = "simple" | "condition_controlled" | "predictive";
export type TierSignalMode = "simplified" | "full" | "predictive";
export type TierConditionMode = "light" | "full" | "predictive";
export type TierPolicyEnforcement = "display_only" | "applied" | "enforced";
export type TierAdaptationMode = "none" | "trigger_based" | "full_simulation";
export type TierKnowledgeInjection = "minimal" | "full" | "predictive";
export type TierBhudhiMode = "EXPLAIN" | "STRUCTURE" | "INTERPRET";

export type TierTargetType =
  | "major"
  | "primary"
  | "vital"
  | "operating"
  | "production"
  | "conditional";

export type TierProjectType = "setup" | "execution" | "analysis" | "optimization";
export type TierActionType = "create" | "replicate" | "analyze" | "improve";
export type TierSeasonName = "ignition" | "foundation" | "traction" | "scale";

/** Full tier rules — stored as JSON snapshot on blueprints.tier_config. */
export interface TierConfig {
  tier: BlueprintTier;
  generation_depth: 1 | 2 | 3;
  intelligence_depth: 1 | 2 | 3;
  plans: string[];
  seasons_enabled: boolean;
  seasons?: TierSeasonName[];
  target_types: TierTargetType[];
  phases: ["initiation", "development", "completion"];
  phase_mode: TierPhaseMode;
  project_types: TierProjectType[];
  action_types: TierActionType[];
  task_style: TierTaskStyle;
  signal_mode: TierSignalMode;
  condition_mode: TierConditionMode;
  policy_enforcement: TierPolicyEnforcement;
  adaptation_mode: TierAdaptationMode;
  knowledge_injection: TierKnowledgeInjection;
  bhudhi_mode: TierBhudhiMode;
  framework_activations_max: number;
  signal_history_days: number;
  bhudhi_memory_days: number;
  /** Ultimate-only dynamic flags (also persisted in tier_config snapshot). */
  dynamic_plan_prioritization?: boolean;
  dynamic_season_rebalancing?: boolean;
  adaptive_targets?: boolean;
  performance_recalibration?: boolean;
  project_reordering?: boolean;
  project_expansion?: boolean;
  impact_ranked_actions?: boolean;
  predictive_signals?: boolean;
}

const PHASES = ["initiation", "development", "completion"] as const;

const STARTER_CONFIG: TierConfig = {
  tier: "starter",
  generation_depth: 1,
  intelligence_depth: 1,
  plans: ["Foundation", "Validation/Proof", "Growth"],
  seasons_enabled: false,
  target_types: ["major", "primary", "production"],
  phases: [...PHASES],
  phase_mode: "linear",
  project_types: ["setup", "execution"],
  action_types: ["create", "analyze"],
  task_style: "simple",
  signal_mode: "simplified",
  condition_mode: "light",
  policy_enforcement: "display_only",
  adaptation_mode: "none",
  knowledge_injection: "minimal",
  bhudhi_mode: "EXPLAIN",
  framework_activations_max: 2,
  signal_history_days: 7,
  bhudhi_memory_days: 0,
};

const GROWTH_CONFIG: TierConfig = {
  tier: "growth",
  generation_depth: 2,
  intelligence_depth: 2,
  plans: ["Foundation", "Validation/Proof", "Growth", "Scale"],
  seasons_enabled: true,
  seasons: ["ignition", "foundation", "traction", "scale"],
  target_types: ["major", "primary", "vital", "operating", "production", "conditional"],
  phases: [...PHASES],
  phase_mode: "gated",
  project_types: ["setup", "execution", "analysis", "optimization"],
  action_types: ["create", "replicate", "analyze", "improve"],
  task_style: "condition_controlled",
  signal_mode: "full",
  condition_mode: "full",
  policy_enforcement: "applied",
  adaptation_mode: "trigger_based",
  knowledge_injection: "full",
  bhudhi_mode: "STRUCTURE",
  framework_activations_max: 4,
  signal_history_days: 30,
  bhudhi_memory_days: 7,
};

const ULTIMATE_CONFIG: TierConfig = {
  tier: "ultimate",
  generation_depth: 3,
  intelligence_depth: 3,
  plans: ["Foundation", "Validation/Proof", "Growth", "Scale"],
  dynamic_plan_prioritization: true,
  seasons_enabled: true,
  seasons: ["ignition", "foundation", "traction", "scale"],
  dynamic_season_rebalancing: true,
  target_types: ["major", "primary", "vital", "operating", "production", "conditional"],
  adaptive_targets: true,
  performance_recalibration: true,
  phases: [...PHASES],
  phase_mode: "adaptive",
  project_types: ["setup", "execution", "analysis", "optimization"],
  project_reordering: true,
  project_expansion: true,
  action_types: ["create", "replicate", "analyze", "improve"],
  impact_ranked_actions: true,
  task_style: "predictive",
  signal_mode: "predictive",
  condition_mode: "predictive",
  policy_enforcement: "enforced",
  adaptation_mode: "full_simulation",
  knowledge_injection: "predictive",
  bhudhi_mode: "INTERPRET",
  framework_activations_max: 14,
  predictive_signals: true,
  signal_history_days: 90,
  bhudhi_memory_days: 30,
};

/** Frozen tier map — never mutate at runtime. */
export const TIER_CONFIG: Readonly<Record<BlueprintTier, TierConfig>> = Object.freeze({
  starter: Object.freeze(STARTER_CONFIG),
  growth: Object.freeze(GROWTH_CONFIG),
  ultimate: Object.freeze(ULTIMATE_CONFIG),
});

export function normalizeBlueprintTier(tier: string | null | undefined): BlueprintTier {
  const t = String(tier ?? "starter").toLowerCase();
  if (t === "starter" || t === "growth" || t === "ultimate") return t;
  return "starter";
}

export function getTierConfig(tier: BlueprintTier | string): TierConfig {
  return TIER_CONFIG[normalizeBlueprintTier(tier)];
}

export type BlueprintTierConfigSource = {
  tier?: string | null;
  tier_config?: unknown;
};

function isTierConfig(value: unknown): value is TierConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as TierConfig;
  return (
    typeof v.generation_depth === "number" &&
    Array.isArray(v.plans) &&
    typeof v.task_style === "string" &&
    typeof v.signal_mode === "string"
  );
}

/** Prefer stored snapshot; fall back to live TIER_CONFIG for the blueprint tier. */
export function getTierConfigFromBlueprint(blueprint: BlueprintTierConfigSource): TierConfig {
  const raw = blueprint.tier_config;
  if (raw && typeof raw === "object" && Object.keys(raw as object).length > 0 && isTierConfig(raw)) {
    return raw;
  }
  return getTierConfig(blueprint.tier ?? "starter");
}

/** Static card copy for tier preview UI (TierPreviewEngine). */
export const TIER_PREVIEW_HEADLINES: Record<BlueprintTier, string> = {
  starter: "Clarity + Guided Execution",
  growth: "Structured Execution + Adaptation",
  ultimate: "Predictive Optimization + Strategic Control",
};
