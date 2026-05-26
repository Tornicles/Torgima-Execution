/** Condition-based task queue bounds (enforcement package + task generation). */
export const CONDITION_TASK_LIMITS: Record<string, { min: number; max: number }> = {
  nothingness: { min: 3, max: 5 },
  danger: { min: 2, max: 4 },
  urgency: { min: 3, max: 5 },
  stability: { min: 4, max: 6 },
  power: { min: 5, max: 7 },
  affluence: { min: 5, max: 8 },
  power_change: { min: 4, max: 6 },
};

const DEFAULT_LIMITS = { min: 3, max: 5 };

export function parseTaskLimits(raw: unknown): { min: number; max: number } {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LIMITS };
  const o = raw as Record<string, unknown>;
  const nested =
    o.taskLimit && typeof o.taskLimit === "object"
      ? (o.taskLimit as { min?: unknown; max?: unknown })
      : null;
  const min = Number(nested?.min ?? o.min ?? DEFAULT_LIMITS.min);
  const max = Number(nested?.max ?? o.max ?? DEFAULT_LIMITS.max);
  return {
    min: Number.isFinite(min) ? Math.max(1, Math.round(min)) : DEFAULT_LIMITS.min,
    max: Number.isFinite(max) ? Math.max(1, Math.round(max)) : DEFAULT_LIMITS.max,
  };
}

export function applyArchetypeTaskLimits(
  condition: string,
  archetypeExecutionMult?: number | null,
): { min: number; max: number } {
  const base = CONDITION_TASK_LIMITS[condition] ?? DEFAULT_LIMITS;
  const mult = archetypeExecutionMult ?? 1;
  const taskMin = Math.max(1, Math.round(base.min * mult));
  const taskMax = Math.min(8, Math.round(base.max * mult));
  return { min: Math.min(taskMin, taskMax), max: Math.max(taskMin, taskMax) };
}

export function computeAdditionalTasksToGenerate(args: {
  pendingCount: number;
  min: number;
  max: number;
  generationMode: string;
  generationTrigger: string;
  queueFill?: boolean;
  targetCount?: number;
  generatedThisInvocation: number;
}): number {
  const { pendingCount, min, max, generationMode, generationTrigger, queueFill, targetCount, generatedThisInvocation } =
    args;

  if (pendingCount >= max) return 0;

  if (targetCount != null) {
    return Math.max(0, Math.min(targetCount - generatedThisInvocation, max - pendingCount));
  }

  const initial =
    generationMode === "initial" ||
    generationTrigger === "blueprint_launched" ||
    generationTrigger === "blueprint_launch";

  const fill =
    queueFill ||
    generationTrigger === "guarantee_check" ||
    generationTrigger === "guarantee_worker" ||
    generationTrigger === "manual_force" ||
    generationTrigger === "api_guarantee";

  if (initial) {
    return Math.max(0, max - pendingCount);
  }

  if (fill || pendingCount < min) {
    return Math.max(0, Math.min(max - pendingCount, min - pendingCount));
  }

  if (generatedThisInvocation >= 1) return 0;
  return Math.min(1, max - pendingCount);
}
