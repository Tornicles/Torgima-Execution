/**
 * Master blueprint rule engine — single source of tier/mode enforcement.
 * Structure is FIXED; tier changes depth/intelligence; mode changes distribution.
 */

import { TorgimaError } from "../../lib/errors.js";

export type BlueprintTier = "starter" | "growth" | "ultimate";
export type BlueprintMode = "individual" | "team";
export type IntelligenceDepth = "guided" | "operational" | "strategic";

export interface TierCapabilities {
  tier: BlueprintTier;
  intelligenceDepth: IntelligenceDepth;
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
  signalComplexity: "minimal" | "full" | "predictive";
  policyEnforcement: "display" | "applied" | "enforced";
  validationDepth: "basic" | "structured" | "simulation";
  maxDailyOrders: number;
  maxFrameworkDecisions: number;
  allowedSystems: string[];
  lockedSystems: string[];
  uiMode: string;
  aiInterpretationDepth: "minimal" | "standard" | "advanced";
}

export interface ModeCapabilities {
  mode: BlueprintMode;
  sharedBlueprint: boolean;
  distributedExecution: boolean;
  teamSignalAggregation: boolean;
  workloadBalancing: boolean;
  targetOwnership: boolean;
  contributorAssignment: boolean;
}

export interface BlueprintSelectionCatalog {
  tiers: Array<{
    id: BlueprintTier;
    label: string;
    tagline: string;
    intelligenceDepth: IntelligenceDepth;
    includes: string[];
    excludes: string[];
    executionDepth: string;
    strategicImplication: string;
  }>;
  modes: Array<{
    id: BlueprintMode;
    label: string;
    tagline: string;
    changes: string[];
    notThis: string;
  }>;
}

const TIER_RULES: Record<BlueprintTier, TierCapabilities> = {
  starter: {
    tier: "starter",
    intelligenceDepth: "guided",
    planCount: 1,
    seasonCount: 1,
    targetCount: 1,
    phaseCount: 3,
    projectsPerActivePhase: 1,
    actionsPerProject: 2,
    linearPhases: true,
    phaseGates: false,
    adaptivePhases: false,
    dependencyEnforcement: false,
    signalComplexity: "minimal",
    policyEnforcement: "display",
    validationDepth: "basic",
    maxDailyOrders: 2,
    maxFrameworkDecisions: 2,
    allowedSystems: [
      "goal", "purpose", "timeframe", "plans", "seasons", "targets", "phases",
      "projects", "actions", "orders", "habits", "feedback", "signals_basic", "consistency",
    ],
    lockedSystems: [
      "predictive_signals", "advanced_adaptation", "advanced_strategy",
      "probability_scoring", "optimization_projects", "advanced_dependencies",
      "active_interrogation", "framework_enforcement", "dynamic_rebalancing",
    ],
    uiMode: "starter",
    aiInterpretationDepth: "minimal",
  },
  growth: {
    tier: "growth",
    intelligenceDepth: "operational",
    planCount: 3,
    seasonCount: 2,
    targetCount: 3,
    phaseCount: 3,
    projectsPerActivePhase: 2,
    actionsPerProject: 3,
    linearPhases: false,
    phaseGates: true,
    adaptivePhases: false,
    dependencyEnforcement: true,
    signalComplexity: "full",
    policyEnforcement: "applied",
    validationDepth: "structured",
    maxDailyOrders: 4,
    maxFrameworkDecisions: 4,
    allowedSystems: [
      "goal", "purpose", "timeframe", "policies", "validation", "plans", "seasons",
      "targets", "phases", "projects", "actions", "orders", "habits", "knowledge",
      "feedback", "active_interrogation", "signals", "conditions", "dependencies",
      "consistency", "character", "strategy", "recovery", "optimization_projects",
    ],
    lockedSystems: [
      "predictive_signals", "probability_scoring", "dynamic_rebalancing",
      "advanced_memory", "strategic_simulations",
    ],
    uiMode: "standard",
    aiInterpretationDepth: "standard",
  },
  ultimate: {
    tier: "ultimate",
    intelligenceDepth: "strategic",
    planCount: 4,
    seasonCount: 4,
    targetCount: 5,
    phaseCount: 3,
    projectsPerActivePhase: 3,
    actionsPerProject: 4,
    linearPhases: false,
    phaseGates: true,
    adaptivePhases: true,
    dependencyEnforcement: true,
    signalComplexity: "predictive",
    policyEnforcement: "enforced",
    validationDepth: "simulation",
    maxDailyOrders: 6,
    maxFrameworkDecisions: 999,
    allowedSystems: [
      "goal", "purpose", "timeframe", "policies", "validation", "plans", "seasons",
      "targets", "phases", "projects", "actions", "orders", "habits", "knowledge",
      "feedback", "active_interrogation", "signals", "conditions", "dependencies",
      "consistency", "character", "strategy", "recovery", "outcome", "meta_system",
      "predictive_signals", "advanced_adaptation", "optimization", "probability_scoring",
      "dynamic_rebalancing", "advanced_memory",
    ],
    lockedSystems: [],
    uiMode: "strategic",
    aiInterpretationDepth: "advanced",
  },
};

const MODE_RULES: Record<BlueprintMode, ModeCapabilities> = {
  individual: {
    mode: "individual",
    sharedBlueprint: false,
    distributedExecution: false,
    teamSignalAggregation: false,
    workloadBalancing: false,
    targetOwnership: false,
    contributorAssignment: false,
  },
  team: {
    mode: "team",
    sharedBlueprint: true,
    distributedExecution: true,
    teamSignalAggregation: true,
    workloadBalancing: true,
    targetOwnership: true,
    contributorAssignment: true,
  },
};

export const BLUEPRINT_SELECTION_CATALOG: BlueprintSelectionCatalog = {
  tiers: [
    {
      id: "starter",
      label: "Starter",
      tagline: "Clarity + guided execution",
      intelligenceDepth: "guided",
      includes: [
        "Simplified structure and linear phases",
        "Guided orders with reduced daily load",
        "Basic signals and light condition control",
        "Minimal habits and display-only policies",
      ],
      excludes: [
        "Predictive systems and advanced adaptation",
        "Deep dependency graphs and framework enforcement",
        "Strategic simulation and optimization layers",
      ],
      executionDepth: "Simple tasks, basic streaks, minimal habits, reduced targets",
      strategicImplication: "Execution-friendly path — the system guides; you execute.",
    },
    {
      id: "growth",
      label: "Growth",
      tagline: "Structured execution + feedback + adaptation",
      intelligenceDepth: "operational",
      includes: [
        "Full blueprint hierarchy with gated phases",
        "Dependency enforcement and structured targets",
        "Full signal + condition systems",
        "Active interrogation and optimization projects",
      ],
      excludes: [
        "Predictive probability scoring",
        "Dynamic rebalancing and strategic simulations",
      ],
      executionDepth: "Full operational chain — plans through orders with traceability",
      strategicImplication: "The full operational system — structured, measurable, adaptive.",
    },
    {
      id: "ultimate",
      label: "Ultimate",
      tagline: "Predictive optimization + strategic control",
      intelligenceDepth: "strategic",
      includes: [
        "Adaptive phases and predictive signals",
        "Advanced strategy, optimization, and recovery",
        "Probability-informed validation",
        "Maximum intelligence depth across layers",
      ],
      excludes: [],
      executionDepth: "Predictive, optimized, fatigue-aware, strategically sequenced orders",
      strategicImplication: "Intelligence-dense — strategic, operational, highly adaptive.",
    },
  ],
  modes: [
    {
      id: "individual",
      label: "Individual",
      tagline: "Single execution system",
      changes: [
        "One execution chain — single ownership",
        "Single signal and condition state",
        "Linear progression through the shared hierarchy",
      ],
      notThis: "Not multiple isolated blueprints per person.",
    },
    {
      id: "team",
      label: "Team",
      tagline: "Shared execution system distributed across members",
      changes: [
        "One shared goal and one shared blueprint",
        "Targets distribute work via ownership and contributors",
        "Team signal aggregation and workload balancing",
        "Coordinated progression — same phase for all members",
      ],
      notThis: "Not separate blueprints per member — one blueprint, distributed execution.",
    },
  ],
};

export function parseTier(value: string | null | undefined): BlueprintTier {
  if (value === "growth" || value === "ultimate") return value;
  return "starter";
}

export function parseMode(value: string | null | undefined): BlueprintMode {
  return value === "team" ? "team" : "individual";
}

export function getTierRules(tier: BlueprintTier): TierCapabilities {
  return TIER_RULES[tier];
}

export function getModeRules(mode: BlueprintMode): ModeCapabilities {
  return MODE_RULES[mode];
}

export function intelligenceDepthForTier(tier: BlueprintTier): IntelligenceDepth {
  return TIER_RULES[tier].intelligenceDepth;
}

export function isSystemAllowed(tier: BlueprintTier, systemKey: string): boolean {
  const rules = TIER_RULES[tier];
  if (rules.lockedSystems.includes(systemKey)) return false;
  return rules.allowedSystems.includes(systemKey) || systemKey.startsWith("core_");
}

export function assertSelectionComplete(params: {
  tier: string | null | undefined;
  mode: string | null | undefined;
  selectionConfirmedAt: Date | null | undefined;
}): void {
  if (!params.tier || !params.mode || !params.selectionConfirmedAt) {
    throw new TorgimaError(
      "BLUEPRINT_SELECTION_REQUIRED",
      "Blueprint tier and mode must be selected before launch",
    );
  }
}

export function buildTraceMetadata(params: {
  layer: string;
  parentId: string | null;
  parentLayer: string | null;
  tier: BlueprintTier;
  mode: BlueprintMode;
  generationReason: string;
}): Record<string, unknown> {
  return {
    sourceLayer: params.layer,
    parentId: params.parentId,
    parentLayer: params.parentLayer,
    tierOrigin: params.tier,
    modeOrigin: params.mode,
    generationReason: params.generationReason,
    generatedAt: new Date().toISOString(),
  };
}

export const DEFAULT_PLAN_NAMES = ["Foundation", "Validation", "Growth", "Scale"] as const;
export const DEFAULT_SEASON_NAMES = ["ignition", "foundation", "traction", "scale"] as const;
