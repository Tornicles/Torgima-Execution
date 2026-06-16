/**
 * DOC24 Task 1 — 6-dimension task value scoring (0–100 composite).
 */

export const TASK_VALUE_WEIGHTS = {
  outcome_alignment: 0.3,
  blueprint_position: 0.2,
  dependency_unlock: 0.2,
  condition_fit: 0.15,
  difficulty_fit: 0.1,
  time_sensitivity: 0.05,
} as const;

export type CandidateTask = {
  id?: string;
  task_type: string;
  difficulty?: string | null;
  due_date?: string | Date | null;
  content_hash?: string | null;
  linked_target_id?: string | null;
  active_target_id?: string | null;
  target_validated?: boolean;
  is_next_blueprint_action?: boolean;
  dependency_unlock_count?: number;
  dependency_unlock_score?: number;
  blocks_other_tasks?: number;
  phase_gate_due?: boolean;
  has_open_blocking_dependency?: boolean;
  last_passed_difficulty?: string | null;
  deadline_hours?: number | null;
};

export type TaskValueContext = {
  condition: string;
  capability: { difficulty_recommendation?: string | null } | null;
  falseProgressActive: boolean;
  activeTargetId?: string | null;
  forceRecovery?: boolean;
  allowedDifficultyMin?: string;
  allowedDifficultyMax?: string;
};

export type DimensionScores = {
  outcome_alignment: number;
  blueprint_position: number;
  dependency_unlock: number;
  condition_fit: number;
  difficulty_fit: number;
  time_sensitivity: number;
};

const DIFFICULTY_RANK: Record<string, number> = {
  very_easy: 1,
  easy: 2,
  moderate: 3,
  hard: 4,
  very_hard: 5,
};

const CONDITION_PREFERRED_TYPES: Record<string, string[]> = {
  danger: ["recovery", "blocker_resolution"],
  nothingness: ["recovery", "clarification"],
  urgency: ["execution", "blocker_resolution"],
  stability: ["execution", "review"],
  power: ["execution", "academy"],
  affluence: ["execution", "review"],
};

function scoreOutcomeAlignment(task: CandidateTask, ctx: TaskValueContext): number {
  const activeTarget = ctx.activeTargetId ?? task.active_target_id;
  if (!activeTarget) return 0.35;
  const tied = task.linked_target_id === activeTarget;
  if (tied && !task.target_validated) return 1;
  if (tied) return 0.65;
  return 0.2;
}

function scoreBlueprintPosition(task: CandidateTask): number {
  return task.is_next_blueprint_action ? 1 : 0.45;
}

function scoreDependencyUnlock(task: CandidateTask): number {
  if (typeof task.dependency_unlock_score === "number") {
    return Math.min(1, task.dependency_unlock_score / 100);
  }
  const blocks = task.blocks_other_tasks ?? task.dependency_unlock_count ?? 0;
  if (blocks >= 3) return 1;
  if (blocks >= 2) return 0.95;
  if (blocks >= 1) return 0.7;
  return 0.25;
}

function scoreConditionFit(task: CandidateTask, ctx: TaskValueContext): number {
  const condition = ctx.condition ?? "stability";
  const preferred = CONDITION_PREFERRED_TYPES[condition] ?? ["execution"];
  let score = preferred.includes(task.task_type) ? 0.85 : 0.45;

  const diff = DIFFICULTY_RANK[task.difficulty ?? "moderate"] ?? 3;
  const min = DIFFICULTY_RANK[ctx.allowedDifficultyMin ?? "easy"] ?? 2;
  const max = DIFFICULTY_RANK[ctx.allowedDifficultyMax ?? "hard"] ?? 4;
  if (diff >= min && diff <= max) score += 0.15;
  else score -= 0.2;

  return Math.min(1, Math.max(0, score));
}

function scoreDifficultyFit(task: CandidateTask, ctx: TaskValueContext): number {
  const lastPassed = ctx.capability?.difficulty_recommendation ?? task.last_passed_difficulty ?? "easy";
  const lastRank = DIFFICULTY_RANK[lastPassed] ?? 2;
  const taskRank = DIFFICULTY_RANK[task.difficulty ?? "moderate"] ?? 3;
  if (taskRank === lastRank + 1) return 1;
  if (taskRank === lastRank) return 0.75;
  if (taskRank < lastRank) return 0.55;
  return 0.25;
}

function scoreTimeSensitivity(task: CandidateTask): number {
  if (task.has_open_blocking_dependency) return 1;
  const hours = task.deadline_hours;
  if (hours == null) return 0.4;
  if (hours <= 0) return 1;
  if (hours <= 24) return 0.9;
  if (hours <= 72) return 0.65;
  return 0.35;
}

export function scoreDimensions(
  task: CandidateTask,
  context: TaskValueContext,
): DimensionScores {
  return {
    outcome_alignment: scoreOutcomeAlignment(task, context),
    blueprint_position: scoreBlueprintPosition(task),
    dependency_unlock: scoreDependencyUnlock(task),
    condition_fit: scoreConditionFit(task, context),
    difficulty_fit: scoreDifficultyFit(task, context),
    time_sensitivity: scoreTimeSensitivity(task),
  };
}

export function score(task: CandidateTask, context: TaskValueContext): number {
  const dims = scoreDimensions(task, context);
  const composite =
    TASK_VALUE_WEIGHTS.outcome_alignment * dims.outcome_alignment +
    TASK_VALUE_WEIGHTS.blueprint_position * dims.blueprint_position +
    TASK_VALUE_WEIGHTS.dependency_unlock * dims.dependency_unlock +
    TASK_VALUE_WEIGHTS.condition_fit * dims.condition_fit +
    TASK_VALUE_WEIGHTS.difficulty_fit * dims.difficulty_fit +
    TASK_VALUE_WEIGHTS.time_sensitivity * dims.time_sensitivity;

  let value = Math.round(composite * 100);

  if (context.falseProgressActive && task.task_type === "execution") {
    value = Math.max(0, value - 25);
  }

  return Math.min(100, Math.max(0, value));
}

export function dependencyUnlockOverrideApplies(task: CandidateTask): boolean {
  const blocks = task.blocks_other_tasks ?? task.dependency_unlock_count ?? 0;
  const unlockScore = task.dependency_unlock_score ?? scoreDependencyUnlock(task) * 100;
  return unlockScore >= 100 && blocks >= 2;
}

/** Backward-compatible wrapper for legacy 5-dimension callers. */
export function computeLegacyTaskValueScore(
  candidate: CandidateTask,
  context: TaskValueContext,
): number {
  return score(candidate, context) / 100;
}
