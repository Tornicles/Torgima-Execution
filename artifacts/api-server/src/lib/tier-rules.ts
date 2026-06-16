// Enforces Starter/Growth/Ultimate behavioral differences.
// Control Engine reads this — Task Generation Engine reads enforcement package.

export const TIER_RULES = {
  starter: {
    stages: ["foundation", "operations", "growth"],
    milestone_types: ["major", "primary", "production"],
    phase_progression: "linear",
    max_tasks_per_day: 4,
    task_difficulty_cap: "hard",
    knowledge_injection: "minimal",
    signal_system: "simplified",
    adaptation: "simple",
    dependency_enforcement: "loose",
    task_limits_by_condition: {
      nothingness: { min: 1, max: 2 },
      danger: { min: 1, max: 2 },
      urgency: { min: 2, max: 3 },
      stability: { min: 2, max: 4 },
      power: { min: 3, max: 4 },
      affluence: { min: 3, max: 4 },
    },
    workload_by_hours: {
      "1-5": { min: 1, max: 2, difficulty_cap: "moderate" },
      "6-10": { min: 2, max: 3, difficulty_cap: "moderate" },
      "11-20": { min: 3, max: 4, difficulty_cap: "hard" },
      "20+": { min: 3, max: 4, difficulty_cap: "hard" },
    },
  },
  growth: {
    stages: ["foundation", "operations", "growth", "scale"],
    milestone_types: ["major", "primary", "vital", "operating", "production", "conditional"],
    phase_progression: "gated",
    max_tasks_per_day: 6,
    task_difficulty_cap: "very_hard",
    knowledge_injection: "full",
    signal_system: "full_7",
    adaptation: "intelligent",
    dependency_enforcement: "strict",
    task_limits_by_condition: {
      nothingness: { min: 1, max: 2 },
      danger: { min: 1, max: 2 },
      urgency: { min: 2, max: 3 },
      stability: { min: 3, max: 5 },
      power: { min: 4, max: 6 },
      affluence: { min: 4, max: 6 },
    },
  },
  ultimate: {
    stages: ["foundation", "operations", "growth", "scale"],
    milestone_types: ["major", "primary", "vital", "operating", "production", "conditional"],
    phase_progression: "adaptive",
    max_tasks_per_day: 8,
    task_difficulty_cap: "very_hard",
    knowledge_injection: "advanced",
    signal_system: "predictive",
    adaptation: "predictive",
    dependency_enforcement: "optimized",
    requires_erector_simulation: true,
    framework_veto_active: true,
    goal_intelligence_active: true,
    prediction_system_active: true,
    task_limits_by_condition: {
      nothingness: { min: 1, max: 2 },
      danger: { min: 1, max: 2 },
      urgency: { min: 2, max: 4 },
      stability: { min: 4, max: 6 },
      power: { min: 5, max: 8 },
      affluence: { min: 5, max: 8 },
    },
  },
} as const;

export type Tier = keyof typeof TIER_RULES;
export type TierConditionKey = keyof (typeof TIER_RULES)["starter"]["task_limits_by_condition"];
export type WorkloadHoursBucket = keyof (typeof TIER_RULES)["starter"]["workload_by_hours"];

const DIFFICULTY_ORDER = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;

export function getTierRules(tier: Tier) {
  return TIER_RULES[tier];
}

export function normalizeBlueprintTierName(tier: string | null | undefined): Tier {
  const t = String(tier ?? "starter").toLowerCase();
  if (t === "starter" || t === "growth" || t === "ultimate") return t;
  return "starter";
}

export function resolveTierConditionKey(condition: string): TierConditionKey {
  const c = condition.toLowerCase();
  if (c === "power_change") return "power";
  if (c in TIER_RULES.starter.task_limits_by_condition) {
    return c as TierConditionKey;
  }
  return "stability";
}

export function resolveWorkloadHoursBucket(hoursPerWeek: number): WorkloadHoursBucket {
  if (hoursPerWeek <= 5) return "1-5";
  if (hoursPerWeek <= 10) return "6-10";
  if (hoursPerWeek <= 20) return "11-20";
  return "20+";
}

function capDifficulty(current: string, cap: string): string {
  const currentIdx = DIFFICULTY_ORDER.indexOf(current as (typeof DIFFICULTY_ORDER)[number]);
  const capIdx = DIFFICULTY_ORDER.indexOf(cap as (typeof DIFFICULTY_ORDER)[number]);
  if (currentIdx < 0) return cap;
  if (capIdx < 0) return current;
  return DIFFICULTY_ORDER[Math.min(currentIdx, capIdx)]!;
}

export interface TierEnforcementResult {
  taskMin: number;
  taskMax: number;
  difficultyCap: string;
  knowledge_injection_level: string;
  phase_progression_type: string;
  tierOverrideFlags: Record<string, unknown>;
}

/** Authoritative Starter/Growth/Ultimate limits for enforcement packages. */
export function computeTierEnforcementLimits(
  tier: Tier,
  condition: string,
  hoursPerWeek?: number | null,
): TierEnforcementResult {
  const tierRules = getTierRules(tier);
  const conditionKey = resolveTierConditionKey(condition);
  const conditionLimits = tierRules.task_limits_by_condition[conditionKey];

  let taskMin: number = conditionLimits.min;
  let taskMax: number = Math.min(conditionLimits.max, tierRules.max_tasks_per_day);
  let difficultyCap: string = tierRules.task_difficulty_cap;

  if (tier === "starter" && hoursPerWeek != null && Number.isFinite(hoursPerWeek)) {
    const bucket = resolveWorkloadHoursBucket(hoursPerWeek);
    const workload = TIER_RULES.starter.workload_by_hours[bucket];
    taskMin = Math.max(taskMin, workload.min);
    taskMax = Math.min(taskMax, workload.max);
    difficultyCap = capDifficulty(difficultyCap, workload.difficulty_cap);
  }

  const tierOverrideFlags: Record<string, unknown> = {
    knowledge_injection_level: tierRules.knowledge_injection,
    phase_progression_type: tierRules.phase_progression,
  };

  if ("framework_veto_active" in tierRules) {
    tierOverrideFlags.framework_veto_active = tierRules.framework_veto_active;
    tierOverrideFlags.requires_erector_simulation = tierRules.requires_erector_simulation;
    tierOverrideFlags.goal_intelligence_active = tierRules.goal_intelligence_active;
    tierOverrideFlags.prediction_system_active = tierRules.prediction_system_active;
  }

  return {
    taskMin,
    taskMax,
    difficultyCap,
    knowledge_injection_level: tierRules.knowledge_injection,
    phase_progression_type: tierRules.phase_progression,
    tierOverrideFlags,
  };
}
