/**
 * @deprecated Prefer TierConfig.ts — kept for BlueprintGenerationService compatibility.
 */
import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import { getBlueprintTypeConfig } from "./infrastructure/BlueprintTypeRegistry.js";
import { intelligenceDepthForTier } from "./BlueprintRuleEngine.js";
import { getTierConfig, normalizeBlueprintTier, TIER_CONFIG as TIER_CONFIG_FULL } from "./TierConfig.js";

export type TierBlueprintConfig = {
  plans: string[];
  targetsPerPlan: number;
  phasesPerTarget: number;
  projectsPerPhase: number;
  actionsPerProject: number;
  dailyTaskMin: number;
  dailyTaskMax: number;
  difficultyCap: string;
  intelligenceDepth: ReturnType<typeof intelligenceDepthForTier>;
};

const DAILY_TASK_LIMITS: Record<BlueprintTier, { min: number; max: number; difficultyCap: string }> = {
  starter: { min: 1, max: 2, difficultyCap: "easy" },
  growth: { min: 1, max: 3, difficultyCap: "easy" },
  ultimate: { min: 1, max: 3, difficultyCap: "easy" },
};

/** @deprecated Use TierConfig.TIER_CONFIG */
export const TIER_CONFIG: Record<BlueprintTier, TierBlueprintConfig> = {
  starter: tierBlueprintConfigFromFull("starter"),
  growth: tierBlueprintConfigFromFull("growth"),
  ultimate: tierBlueprintConfigFromFull("ultimate"),
};

function tierBlueprintConfigFromFull(tier: BlueprintTier): TierBlueprintConfig {
  const cfg = TIER_CONFIG_FULL[tier];
  const limits = DAILY_TASK_LIMITS[tier];
  return {
    plans: [...cfg.plans],
    targetsPerPlan: cfg.target_types.length,
    phasesPerTarget: cfg.phases.length,
    projectsPerPhase: cfg.project_types.length,
    actionsPerProject: cfg.action_types.length,
    dailyTaskMin: limits.min,
    dailyTaskMax: limits.max,
    difficultyCap: limits.difficultyCap,
    intelligenceDepth: intelligenceDepthForTier(tier),
  };
}

export function getTierBlueprintConfig(tier: BlueprintTier | string | null | undefined): TierBlueprintConfig {
  const key = normalizeBlueprintTier(tier);
  const base = tierBlueprintConfigFromFull(key);
  const registry = getBlueprintTypeConfig(key);
  const full = getTierConfig(key);
  return {
    ...base,
    plans: [...full.plans],
    targetsPerPlan: Math.max(base.targetsPerPlan, Math.ceil(registry.targetCount / registry.planCount)),
    projectsPerPhase: registry.projectsPerActivePhase,
    actionsPerProject: registry.actionsPerProject,
    dailyTaskMax: Math.min(registry.maxDailyOrders, base.dailyTaskMax),
  };
}
