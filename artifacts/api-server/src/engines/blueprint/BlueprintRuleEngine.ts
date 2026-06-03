/**
 * Master blueprint rule engine — single source of tier/mode enforcement.
 * Structure is FIXED; tier changes depth/intelligence; mode changes distribution.
 */

import { TorgimaError } from "../../lib/errors.js";

export type { BlueprintTier, BlueprintMode, IntelligenceDepth } from "./infrastructure/blueprint-types.js";
import type { BlueprintTier, BlueprintMode, IntelligenceDepth } from "./infrastructure/blueprint-types.js";
import {
  getBlueprintTypeConfig,
  isBlueprintSystemAllowed,
} from "./infrastructure/BlueprintTypeRegistry.js";

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

function mapConfigToTierCapabilities(c: ReturnType<typeof getBlueprintTypeConfig>): TierCapabilities {
  return {
    tier: c.tier,
    intelligenceDepth: c.intelligenceDepth,
    planCount: c.planCount,
    seasonCount: c.seasonCount,
    targetCount: c.targetCount,
    phaseCount: c.phaseCount,
    projectsPerActivePhase: c.projectsPerActivePhase,
    actionsPerProject: c.actionsPerProject,
    linearPhases: c.linearPhases,
    phaseGates: c.phaseGates,
    adaptivePhases: c.adaptivePhases,
    dependencyEnforcement: c.dependencyEnforcement,
    signalComplexity: c.allowedSignalComplexity,
    policyEnforcement: c.policyEnforcement,
    validationDepth: c.validationDepth,
    maxDailyOrders: c.maxDailyOrders,
    maxFrameworkDecisions: c.maxFrameworkDecisions,
    allowedSystems: c.allowedSystems,
    lockedSystems: c.lockedSystems,
    uiMode: c.uiMode,
    aiInterpretationDepth: c.allowedAiInterpretationDepth,
  };
}

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
  return mapConfigToTierCapabilities(getBlueprintTypeConfig(tier));
}

export function getModeRules(mode: BlueprintMode): ModeCapabilities {
  return MODE_RULES[mode];
}

export function intelligenceDepthForTier(tier: BlueprintTier): IntelligenceDepth {
  return getBlueprintTypeConfig(tier).intelligenceDepth;
}

export function isSystemAllowed(tier: BlueprintTier, systemKey: string): boolean {
  return isBlueprintSystemAllowed(tier, systemKey);
}

export function assertSelectionComplete(params: {
  blueprintId?: string;
  status?: string | null;
  tier: string | null | undefined;
  mode: string | null | undefined;
  selectionConfirmedAt: Date | null | undefined;
}): void {
  const missing: string[] = [];
  if (!params.tier) missing.push("tier");
  if (!params.mode) missing.push("mode");
  if (!params.selectionConfirmedAt) missing.push("selection_confirmed_at");

  if (missing.length > 0) {
    throw new TorgimaError(
      "ACTIVATION_FAILED",
      `Blueprint cannot be launched. Missing required fields: ${missing.join(", ")}. ` +
        `Blueprint ID: ${params.blueprintId ?? "unknown"}, current status: ${params.status ?? "unknown"}`,
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
