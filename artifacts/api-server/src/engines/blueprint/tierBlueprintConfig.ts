import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import { getBlueprintTypeConfig } from "./infrastructure/BlueprintTypeRegistry.js";
import { intelligenceDepthForTier } from "./BlueprintRuleEngine.js";

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

/** Tier-driven hierarchy and task limits — aligned with BlueprintTypeRegistry. */
export const TIER_CONFIG: Record<BlueprintTier, TierBlueprintConfig> = {
  starter: {
    plans: ["Foundation", "Validation / Proof", "Growth"],
    targetsPerPlan: 2,
    phasesPerTarget: 3,
    projectsPerPhase: 2,
    actionsPerProject: 2,
    dailyTaskMin: 1,
    dailyTaskMax: 3,
    difficultyCap: "easy",
    intelligenceDepth: intelligenceDepthForTier("starter"),
  },
  growth: {
    plans: ["Foundation", "Validation / Proof", "Growth", "Scale"],
    targetsPerPlan: 3,
    phasesPerTarget: 3,
    projectsPerPhase: 3,
    actionsPerProject: 3,
    dailyTaskMin: 3,
    dailyTaskMax: 7,
    difficultyCap: "hard",
    intelligenceDepth: intelligenceDepthForTier("growth"),
  },
  ultimate: {
    plans: ["Foundation", "Validation / Proof", "Growth", "Scale"],
    targetsPerPlan: 5,
    phasesPerTarget: 3,
    projectsPerPhase: 4,
    actionsPerProject: 4,
    dailyTaskMin: 5,
    dailyTaskMax: 8,
    difficultyCap: "very_hard",
    intelligenceDepth: intelligenceDepthForTier("ultimate"),
  },
};

export function getTierBlueprintConfig(tier: BlueprintTier | string | null | undefined): TierBlueprintConfig {
  const key = tier === "starter" || tier === "growth" || tier === "ultimate" ? tier : "growth";
  const base = TIER_CONFIG[key];
  const registry = getBlueprintTypeConfig(key);
  return {
    ...base,
    targetsPerPlan: Math.max(base.targetsPerPlan, Math.ceil(registry.targetCount / registry.planCount)),
    projectsPerPhase: registry.projectsPerActivePhase,
    actionsPerProject: registry.actionsPerProject,
    dailyTaskMax: registry.maxDailyOrders,
  };
}
