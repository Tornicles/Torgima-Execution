/**
 * Canonical Blueprint Type Registry — single source of truth for Starter / Growth / Ultimate.
 */

import type { BlueprintMode, BlueprintTier, IntelligenceDepth } from "./blueprint-types.js";

export interface BlueprintTypeConfig {
  tier: BlueprintTier;
  intelligenceDepth: IntelligenceDepth;
  allowedSystems: string[];
  allowedPlans: string[];
  allowedTargets: string[];
  allowedSignalComplexity: "minimal" | "full" | "predictive";
  allowedDependencyComplexity: "none" | "linear" | "graph";
  allowedAiInterpretationDepth: "minimal" | "standard" | "advanced";
  allowedAdaptationDepth: "none" | "feedback" | "predictive";
  allowedVisibility: "guided" | "operational" | "strategic";
  allowedFrameworks: "monitor_only" | "limited" | "full";
  allowedOptimizationSystems: boolean;
  allowedStrategicLayers: string[];
  allowedMemorySystems: string[];
  allowedTeamCoordination: string[];
  planCount: number;
  seasonCount: number;
  targetCount: number;
  phaseCount: number;
  projectsPerActivePhase: number;
  actionsPerProject: number;
  linearPhases: boolean;
  phaseGates: boolean;
  adaptivePhases: boolean;
  dependencyEnforcement: boolean;
  policyEnforcement: "display" | "applied" | "enforced";
  validationDepth: "basic" | "structured" | "simulation";
  maxDailyOrders: number;
  maxFrameworkDecisions: number;
  lockedSystems: string[];
  uiMode: string;
}

export const STARTER_BLUEPRINT_CONFIG: BlueprintTypeConfig = {
  tier: "starter",
  intelligenceDepth: "guided",
  allowedSystems: [
    "goal", "purpose", "timeframe", "plans", "seasons", "targets", "phases",
    "projects", "actions", "orders", "habits", "feedback", "signals_basic", "consistency",
  ],
  allowedPlans: ["foundation", "validation", "growth"],
  allowedTargets: ["major", "primary", "production"],
  allowedSignalComplexity: "minimal",
  allowedDependencyComplexity: "none",
  allowedAiInterpretationDepth: "minimal",
  allowedAdaptationDepth: "none",
  allowedVisibility: "guided",
  allowedFrameworks: "monitor_only",
  allowedOptimizationSystems: false,
  allowedStrategicLayers: ["goal", "plan", "order"],
  allowedMemorySystems: ["execution_baseline"],
  allowedTeamCoordination: [],
  planCount: 3,
  seasonCount: 1,
  targetCount: 9,
  phaseCount: 3,
  projectsPerActivePhase: 2,
  actionsPerProject: 2,
  linearPhases: true,
  phaseGates: false,
  adaptivePhases: false,
  dependencyEnforcement: false,
  policyEnforcement: "display",
  validationDepth: "basic",
  maxDailyOrders: 7,
  maxFrameworkDecisions: 2,
  lockedSystems: [
    "predictive_signals", "advanced_adaptation", "advanced_strategy",
    "probability_scoring", "optimization_projects", "advanced_dependencies",
    "active_interrogation", "framework_enforcement", "dynamic_rebalancing",
    "team_signal_aggregation", "operational_graph_full",
  ],
  uiMode: "starter",
};

export const GROWTH_BLUEPRINT_CONFIG: BlueprintTypeConfig = {
  tier: "growth",
  intelligenceDepth: "operational",
  allowedSystems: [
    "goal", "purpose", "timeframe", "policies", "validation", "plans", "seasons",
    "targets", "phases", "projects", "actions", "orders", "habits", "knowledge",
    "feedback", "active_interrogation", "signals", "conditions", "dependencies",
    "consistency", "character", "strategy", "recovery", "optimization_projects",
  ],
  allowedPlans: ["foundation", "validation", "growth", "scale"],
  allowedTargets: ["major", "primary", "vital", "operating", "production", "conditional"],
  allowedSignalComplexity: "full",
  allowedDependencyComplexity: "linear",
  allowedAiInterpretationDepth: "standard",
  allowedAdaptationDepth: "feedback",
  allowedVisibility: "operational",
  allowedFrameworks: "limited",
  allowedOptimizationSystems: true,
  allowedStrategicLayers: ["goal", "plan", "season", "target", "phase", "strategy"],
  allowedMemorySystems: ["execution_baseline", "feedback_history", "condition_history"],
  allowedTeamCoordination: ["ownership", "contributors", "dependency_propagation"],
  planCount: 4,
  seasonCount: 4,
  targetCount: 24,
  phaseCount: 3,
  projectsPerActivePhase: 4,
  actionsPerProject: 4,
  linearPhases: false,
  phaseGates: true,
  adaptivePhases: false,
  dependencyEnforcement: true,
  policyEnforcement: "applied",
  validationDepth: "structured",
  maxDailyOrders: 8,
  maxFrameworkDecisions: 4,
  lockedSystems: [
    "predictive_signals", "probability_scoring", "dynamic_rebalancing",
    "advanced_memory", "strategic_simulations",
  ],
  uiMode: "standard",
};

export const ULTIMATE_BLUEPRINT_CONFIG: BlueprintTypeConfig = {
  tier: "ultimate",
  intelligenceDepth: "strategic",
  allowedSystems: [
    "goal", "purpose", "timeframe", "policies", "validation", "plans", "seasons",
    "targets", "phases", "projects", "actions", "orders", "habits", "knowledge",
    "feedback", "active_interrogation", "signals", "conditions", "dependencies",
    "consistency", "character", "strategy", "recovery", "outcome", "meta_system",
    "predictive_signals", "advanced_adaptation", "optimization", "probability_scoring",
    "dynamic_rebalancing", "advanced_memory", "operational_graph_full",
  ],
  allowedPlans: ["foundation", "validation", "growth", "scale"],
  allowedTargets: ["major", "primary", "vital", "operating", "production", "conditional"],
  allowedSignalComplexity: "predictive",
  allowedDependencyComplexity: "graph",
  allowedAiInterpretationDepth: "advanced",
  allowedAdaptationDepth: "predictive",
  allowedVisibility: "strategic",
  allowedFrameworks: "full",
  allowedOptimizationSystems: true,
  allowedStrategicLayers: [
    "goal", "plan", "season", "target", "phase", "project", "strategy", "outcome", "meta",
  ],
  allowedMemorySystems: [
    "execution_baseline", "feedback_history", "condition_history", "adaptation_snapshots",
    "strategic_memory",
  ],
  allowedTeamCoordination: [
    "ownership", "contributors", "dependency_propagation", "workload_balancing",
    "team_signal_aggregation", "bottleneck_detection",
  ],
  planCount: 4,
  seasonCount: 4,
  targetCount: 24,
  phaseCount: 3,
  projectsPerActivePhase: 4,
  actionsPerProject: 5,
  linearPhases: false,
  phaseGates: true,
  adaptivePhases: true,
  dependencyEnforcement: true,
  policyEnforcement: "enforced",
  validationDepth: "simulation",
  maxDailyOrders: 8,
  maxFrameworkDecisions: 999,
  lockedSystems: [],
  uiMode: "strategic",
};

const REGISTRY: Record<BlueprintTier, BlueprintTypeConfig> = {
  starter: STARTER_BLUEPRINT_CONFIG,
  growth: GROWTH_BLUEPRINT_CONFIG,
  ultimate: ULTIMATE_BLUEPRINT_CONFIG,
};

export function getBlueprintTypeConfig(tier: BlueprintTier): BlueprintTypeConfig {
  return REGISTRY[tier];
}

export function isBlueprintSystemAllowed(tier: BlueprintTier, systemKey: string): boolean {
  const cfg = REGISTRY[tier];
  if (cfg.lockedSystems.includes(systemKey)) return false;
  return cfg.allowedSystems.includes(systemKey) || systemKey.startsWith("core_");
}

export function getClientFeatureManifest(tier: BlueprintTier, mode: BlueprintMode) {
  const cfg = REGISTRY[tier];
  return {
    tier: cfg.tier,
    mode,
    intelligenceDepth: cfg.intelligenceDepth,
    allowedSystems: cfg.allowedSystems,
    lockedSystems: cfg.lockedSystems,
    visibility: cfg.allowedVisibility,
    adaptationDepth: cfg.allowedAdaptationDepth,
    signalComplexity: cfg.allowedSignalComplexity,
    teamCoordination: mode === "team" ? cfg.allowedTeamCoordination : [],
  };
}
