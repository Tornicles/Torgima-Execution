/**
 * TORGIMA P4 — tier-specific task limits, signal depth, and framework caps.
 */

export type TierName = "starter" | "growth" | "ultimate";

export type TierProfile = {
  tier: TierName;
  taskMin: number;
  taskMax: number;
  difficultyMax: string;
  signalMode: "simplified" | "full" | "predictive";
  activeFrameworkCap: number;
  weeklyReview: boolean;
  academyDepth: "minimal" | "standard" | "advanced";
};

const STARTER_SIGNAL_MAP: Record<string, string> = {
  nothingness: "STARTING",
  danger: "STRUGGLING",
  urgency: "STRUGGLING",
  stability: "STABLE",
  power: "IMPROVING",
  affluence: "IMPROVING",
  power_change: "IMPROVING",
};

export function getTierProfile(tier: string): TierProfile {
  const t = (tier === "growth" || tier === "ultimate" ? tier : "starter") as TierName;
  if (t === "ultimate") {
    return {
      tier: t,
      taskMin: 3,
      taskMax: 6,
      difficultyMax: "very_hard",
      signalMode: "predictive",
      activeFrameworkCap: 14,
      weeklyReview: true,
      academyDepth: "advanced",
    };
  }
  if (t === "growth") {
    return {
      tier: t,
      taskMin: 2,
      taskMax: 4,
      difficultyMax: "hard",
      signalMode: "full",
      activeFrameworkCap: 4,
      weeklyReview: true,
      academyDepth: "standard",
    };
  }
  return {
    tier: "starter",
    taskMin: 1,
    taskMax: 2,
    difficultyMax: "medium",
    signalMode: "simplified",
    activeFrameworkCap: 2,
    weeklyReview: false,
    academyDepth: "minimal",
  };
}

export function getTaskLimitsForTier(
  tier: string,
  condition: string,
): { min: number; max: number; difficultyMax: string } {
  const profile = getTierProfile(tier);
  let max = profile.taskMax;
  if (condition === "danger") max = Math.min(max, 2);
  if (condition === "nothingness") max = 1;
  return { min: profile.taskMin, max, difficultyMax: profile.difficultyMax };
}

export function getSignalModeForTier(tier: string): TierProfile["signalMode"] {
  return getTierProfile(tier).signalMode;
}

export function mapStarterSignalLabel(condition: string): string | null {
  if (getSignalModeForTier("starter") !== "simplified") return null;
  return STARTER_SIGNAL_MAP[condition.toLowerCase()] ?? "STARTING";
}

/** Apply tier caps onto condition base rules (used by ControlEngine). */
export function applyTierToConditionRules(
  base: { taskMin: number; taskMax: number; difficultyCap: string },
  tier: string,
): { taskMin: number; taskMax: number; difficultyCap: string } {
  const limits = getTaskLimitsForTier(tier, "stability");
  const DIFFICULTY_LEVELS = ["very_easy", "easy", "moderate", "medium", "hard", "very_hard"];
  const capIdx = DIFFICULTY_LEVELS.indexOf(base.difficultyCap);
  const tierIdx = DIFFICULTY_LEVELS.indexOf(limits.difficultyMax);
  const difficultyCap =
    capIdx >= 0 && tierIdx >= 0
      ? DIFFICULTY_LEVELS[Math.min(capIdx, tierIdx)] ?? base.difficultyCap
      : limits.difficultyMax;

  return {
    taskMin: Math.max(base.taskMin, limits.min),
    taskMax: Math.min(base.taskMax, limits.max),
    difficultyCap,
  };
}
