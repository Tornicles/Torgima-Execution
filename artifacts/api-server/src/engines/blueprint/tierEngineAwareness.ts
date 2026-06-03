/**
 * Tier engine awareness — reads blueprints.tier_config snapshot for downstream engines.
 */

import { blueprints, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getTierConfigFromBlueprint, type TierConfig } from "./TierConfig.js";
import { mapStarterSignalLabel } from "../../services/TierDifferentiationService.js";
import type { BlueprintTier } from "./infrastructure/blueprint-types.js";
import { normalizeBlueprintTier } from "./TierConfig.js";

export type SimplifiedSignalState = "starting" | "struggling" | "stable" | "improving";

export type BlueprintTierRow = {
  tier?: string | null;
  tier_config?: unknown;
  signal_mode?: string | null;
  intelligence_depth?: string | null;
  adaptation_mode?: string | null;
};

export function resolveTierConfigFromRow(row: BlueprintTierRow): TierConfig {
  return getTierConfigFromBlueprint(row);
}

export async function loadBlueprintTierContext(blueprintId: string): Promise<{
  tier: BlueprintTier;
  tierConfig: TierConfig;
  signalMode: TierConfig["signal_mode"];
  conditionMode: TierConfig["condition_mode"];
  taskStyle: TierConfig["task_style"];
  intelligenceDepth: string | null;
} | null> {
  const [row] = await db
    .select({
      tier: blueprints.tier,
      tier_config: blueprints.tier_config,
      signal_mode: blueprints.signal_mode,
      intelligence_depth: blueprints.intelligence_depth,
      adaptation_mode: blueprints.adaptation_mode,
    })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);
  if (!row) return null;
  const tier = normalizeBlueprintTier(row.tier);
  const tierConfig = resolveTierConfigFromRow(row);
  return {
    tier,
    tierConfig,
    signalMode: (row.signal_mode as TierConfig["signal_mode"]) ?? tierConfig.signal_mode,
    conditionMode: tierConfig.condition_mode,
    taskStyle: tierConfig.task_style,
    intelligenceDepth: row.intelligence_depth ?? null,
  };
}

/** Map 7-condition signal to starter simplified states. */
export function mapSimplifiedSignalState(condition: string): SimplifiedSignalState {
  const label = mapStarterSignalLabel(condition);
  if (label === "STRUGGLING") return "struggling";
  if (label === "STABLE") return "stable";
  if (label === "IMPROVING") return "improving";
  return "starting";
}

export function buildSignalTierExtensions(params: {
  signalMode: TierConfig["signal_mode"];
  assignedCondition: string;
  momentum: number;
  completionRate: number;
  trend: string;
}): Record<string, unknown> {
  const tierAware: Record<string, unknown> = { signal_mode: params.signalMode };
  if (params.signalMode === "simplified") {
    tierAware.simplified_state = mapSimplifiedSignalState(params.assignedCondition);
  }
  if (params.signalMode === "predictive") {
    const projected =
      params.trend === "up" ? "improving"
      : params.trend === "down" ? "declining"
      : "stable";
    tierAware.projected_signal = projected;
    tierAware.burnout_risk = Math.min(
      1,
      Math.max(0, (1 - params.completionRate) * 0.4 + (params.momentum < 30 ? 0.35 : 0.1)),
    );
  }
  return tierAware;
}

export function applyConditionModeToRules(
  conditionMode: TierConfig["condition_mode"],
  rules: {
    taskMin: number;
    taskMax: number;
    difficultyCap: string;
    phasePermission: string;
  },
): typeof rules & { condition_mode: string; forecast_condition?: string } {
  if (conditionMode === "light") {
    return {
      ...rules,
      taskMin: 1,
      taskMax: 2,
      difficultyCap: "easy",
      phasePermission: "normal",
      condition_mode: "light",
    };
  }
  if (conditionMode === "predictive") {
    return {
      ...rules,
      condition_mode: "predictive",
      forecast_condition: rules.taskMax >= 6 ? "power" : rules.taskMax >= 4 ? "stability" : "urgency",
    };
  }
  return { ...rules, condition_mode: "full" };
}

export function applyEnforcementTierOverrides(
  tierConfig: TierConfig,
  blueprintTier: BlueprintTier,
  rules: { taskMin: number; taskMax: number; difficultyCap: string },
  capabilityLevel: string,
): {
  taskMin: number;
  taskMax: number;
  difficultyCap: string;
  frameworkActivationsMax: number;
} {
  const maxBonus = blueprintTier === "ultimate" ? 2 : blueprintTier === "growth" ? 1 : 0;
  const DIFFICULTY_LEVELS = ["very_easy", "easy", "moderate", "hard", "very_hard"];
  let difficultyCap = rules.difficultyCap;
  if (blueprintTier === "ultimate" && capabilityLevel !== "beginner") {
    const idx = DIFFICULTY_LEVELS.indexOf(difficultyCap);
    if (idx >= 0 && idx < DIFFICULTY_LEVELS.length - 1) {
      difficultyCap = DIFFICULTY_LEVELS[idx + 1]!;
    }
  }
  return {
    taskMin: rules.taskMin,
    taskMax: Math.min(10, rules.taskMax + maxBonus),
    difficultyCap,
    frameworkActivationsMax: tierConfig.framework_activations_max,
  };
}

export function conditionExplanationForTier(
  conditionMode: TierConfig["condition_mode"],
  condition: string,
): string {
  const key = condition.toLowerCase();
  if (conditionMode === "light") {
    const simple: Record<string, string> = {
      nothingness: "You're getting started — focus on one clear step today.",
      danger: "Things feel stuck — we'll keep tasks small until momentum returns.",
      urgency: "Pick up the pace with short, doable tasks.",
      stability: "You're in a steady groove — keep the rhythm.",
      power: "Strong momentum — stay focused on what matters most.",
      affluence: "You're executing well — protect focus and avoid overload.",
      power_change: "Your execution pattern is shifting — stabilize before scaling.",
    };
    return simple[key] ?? "Your system is calibrating to how you're executing.";
  }
  const full: Record<string, string> = {
    nothingness: "Bootstrap condition — building signal baseline before full enforcement.",
    danger: "Recovery posture — reduced task volume and difficulty cap enforced.",
    urgency: "Stabilization posture — elevated task floor with scaling blocked.",
    stability: "Standard execution — balanced limits and full signal authority.",
    power: "Expansion posture — higher task ceiling and scaling permitted.",
    affluence: "Strategic execution — maximum capacity within tier limits.",
    power_change: "Transition posture — phase locks active until pattern stabilizes.",
  };
  return full[key] ?? `Operational condition: ${condition.replace(/_/g, " ")}`;
}

export function signalDisplayLabel(params: {
  signalMode: TierConfig["signal_mode"];
  condition: string;
  simplifiedLabel?: string | null;
}): string {
  if (params.signalMode === "simplified") {
    const state = mapSimplifiedSignalState(params.condition);
    return state.charAt(0).toUpperCase() + state.slice(1);
  }
  if (params.simplifiedLabel) return params.simplifiedLabel;
  return params.condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
