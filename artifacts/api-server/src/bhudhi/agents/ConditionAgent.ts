import { db, conditions, enforcementPackages } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { getConditionContract } from "../../engines/blueprint/infrastructure/ConditionEnforcementMatrix.js";
import {
  CONDITION_TONE_MAP,
  FOCUS_MAP,
  INTENSITY_MAP,
  normalizeCondition,
  type ConditionCode,
} from "./conditionMaps.js";

export interface ConditionBehavioralProfile {
  condition: ConditionCode;
  taskTone: string;
  maxDifficulty: string;
  maxActiveTasks: number;
  taskIntensity: "low" | "medium" | "high";
  focusType: "stabilize" | "maintain" | "optimize" | "scale";
  workloadRecommendation: string;
  recoveryRequired: boolean;
  scalingAllowed: boolean;
  conditionExplanation: string;
}

const WORKLOAD_COPY: Record<ConditionCode, string> = {
  nothingness: "Take one small, low-pressure step. Momentum matters more than scope.",
  danger: "Stabilize execution — one verifiable action before expanding.",
  urgency: "Restore consistency with a clear, completable task today.",
  stability: "Maintain steady execution toward your active milestone.",
  power: "Push forward with an ambitious but completable challenge.",
  affluence: "Leverage your momentum — focus on high-impact execution.",
  power_change: "Stay steady while your system adapts to recent shifts.",
};

export async function getBehavioralProfile(
  userId: string,
  blueprintId: string,
): Promise<ConditionBehavioralProfile> {
  const [cond] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(
      and(
        eq(conditions.user_id, userId),
        eq(conditions.blueprint_id, blueprintId),
        eq(conditions.is_current, true),
      ),
    )
    .limit(1);

  const condition = normalizeCondition(cond?.condition ?? "stability");

  const [pkg] = await db
    .select({
      difficulty_cap: enforcementPackages.difficulty_cap,
      task_limits: enforcementPackages.task_limits,
    })
    .from(enforcementPackages)
    .where(
      and(eq(enforcementPackages.blueprint_id, blueprintId), eq(enforcementPackages.is_current, true)),
    )
    .limit(1);

  const contract = getConditionContract(condition);
  const limits = (pkg?.task_limits as { min?: number; max?: number }) ?? {
    min: contract.taskMin,
    max: contract.taskMax,
  };

  return {
    condition,
    taskTone: CONDITION_TONE_MAP[condition],
    maxDifficulty: pkg?.difficulty_cap ?? "moderate",
    maxActiveTasks: limits.max ?? contract.taskMax,
    taskIntensity: INTENSITY_MAP[condition],
    focusType: FOCUS_MAP[condition],
    workloadRecommendation: WORKLOAD_COPY[condition],
    recoveryRequired: condition === "danger" || condition === "nothingness",
    scalingAllowed: contract.scalingAllowed,
    conditionExplanation: `Current condition is ${condition}. ${WORKLOAD_COPY[condition]}`,
  };
}
