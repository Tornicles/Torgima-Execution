import { TorgimaError } from "../../../lib/errors.js";
import type { BlueprintMode, BlueprintTier } from "./blueprint-types.js";
import { getBlueprintTypeConfig, isBlueprintSystemAllowed } from "./BlueprintTypeRegistry.js";

export type GateSurface = "api" | "generation" | "frontend" | "ai" | "adaptation";

export function assertFeatureAllowed(params: {
  tier: BlueprintTier;
  mode: BlueprintMode;
  feature: string;
  surface: GateSurface;
}): void {
  if (!isBlueprintSystemAllowed(params.tier, params.feature)) {
    throw new TorgimaError(
      "FEATURE_DISABLED",
      `${params.feature} is not available on ${params.tier} tier (${params.surface})`,
    );
  }
  if (params.feature === "team_signal_aggregation" && params.mode !== "team") {
    throw new TorgimaError("FEATURE_DISABLED", "Team features require team mode");
  }
}

export function isFeatureAllowed(tier: BlueprintTier, feature: string, mode: BlueprintMode = "individual"): boolean {
  if (!isBlueprintSystemAllowed(tier, feature)) return false;
  if (feature.startsWith("team_") && mode !== "team") return false;
  return true;
}

export function gateGenerationCapabilities(tier: BlueprintTier) {
  const cfg = getBlueprintTypeConfig(tier);
  return {
    maxDailyOrders: cfg.maxDailyOrders,
    maxFrameworkDecisions: cfg.maxFrameworkDecisions,
    dependencyEnforcement: cfg.dependencyEnforcement,
    adaptivePhases: cfg.adaptivePhases,
    optimization: cfg.allowedOptimizationSystems,
    aiDepth: cfg.allowedAiInterpretationDepth,
    signalComplexity: cfg.allowedSignalComplexity,
  };
}
