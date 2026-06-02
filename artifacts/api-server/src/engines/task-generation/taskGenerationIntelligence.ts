/**
 * Phase 8 — pattern + friction intelligence wired into task generation (extend only).
 */

import type { behaviorPatterns } from "@workspace/db";
import { getActivePatterns } from "../pattern/PatternLearningEngine.js";
import { getFrictionMapForGeneration } from "../friction/FrictionDetectionEngine.js";
import { computeFrictionScore, type FrictionMap } from "../friction/frictionWindowScoring.js";

const DIFFICULTY_ORDER = [
  "very_easy",
  "easy",
  "medium",
  "hard",
  "very_hard",
] as const;

export type ActivePatternRow = typeof behaviorPatterns.$inferSelect;

export type TaskGenerationIntelligence = {
  activePatterns: ActivePatternRow[];
  frictionMap: FrictionMap;
  avoidedTaskTypes: Set<string>;
  recoverySuccessActive: boolean;
};

function patternSpecLabel(p: ActivePatternRow): string {
  const evidence = (p.evidence_json ?? {}) as Record<string, unknown>;
  return String(evidence.spec_label ?? p.pattern_type ?? "");
}

export function isPatternActive(
  patterns: ActivePatternRow[],
  specLabel: string,
): ActivePatternRow | undefined {
  return patterns.find((p) => patternSpecLabel(p) === specLabel && p.status === "active");
}

export async function loadTaskGenerationIntelligence(params: {
  userId: string;
  blueprintId: string;
}): Promise<TaskGenerationIntelligence> {
  const [activePatterns, frictionMap] = await Promise.all([
    getActivePatterns(params.userId, params.blueprintId),
    getFrictionMapForGeneration(params),
  ]);

  const avoidedTaskTypes = new Set<string>();
  for (const [key, entry] of Object.entries(frictionMap)) {
    if (entry.frictionScore > 1.0 && entry.taskType) {
      avoidedTaskTypes.add(entry.taskType);
    } else if (entry.frictionScore > 1.0 && !key.startsWith("__")) {
      avoidedTaskTypes.add(key);
    }
  }

  const recoverySuccessActive = Boolean(isPatternActive(activePatterns, "RECOVERY_SUCCESS"));

  return {
    activePatterns,
    frictionMap,
    avoidedTaskTypes,
    recoverySuccessActive,
  };
}

export function reduceDifficultyOneLevel(cap: string): string {
  const idx = (DIFFICULTY_ORDER as readonly string[]).indexOf(cap);
  if (idx <= 0) return DIFFICULTY_ORDER[0]!;
  return DIFFICULTY_ORDER[idx - 1]!;
}

/** Apply pattern-aware adjustments to enforcement cap and task-type weights. */
export function applyPatternRulesToGeneration(params: {
  intelligence: TaskGenerationIntelligence;
  difficultyCap: string;
  taskTypeWeights: Map<string, number>;
}): { difficultyCap: string; deprioritizedTypes: Set<string> } {
  let difficultyCap = params.difficultyCap;
  const deprioritizedTypes = new Set<string>();

  const fatigue = isPatternActive(params.intelligence.activePatterns, "FATIGUE_RISK");
  if (fatigue) {
    difficultyCap = reduceDifficultyOneLevel(difficultyCap);
  }

  const difficultyFailure = isPatternActive(
    params.intelligence.activePatterns,
    "DIFFICULTY_FAILURE",
  );
  if (difficultyFailure) {
    const evidence = (difficultyFailure.evidence_json ?? {}) as Record<string, unknown>;
    const failedLevel = String(evidence.difficulty_level ?? evidence.failed_difficulty ?? "");
    if (failedLevel && (DIFFICULTY_ORDER as readonly string[]).includes(failedLevel)) {
      deprioritizedTypes.add(`difficulty:${failedLevel}`);
    }
  }

  const avoidance = isPatternActive(
    params.intelligence.activePatterns,
    "TASK_TYPE_AVOIDANCE",
  );
  if (avoidance) {
    const evidence = (avoidance.evidence_json ?? {}) as Record<string, unknown>;
    const tt = String(evidence.task_type ?? evidence.avoided_task_type ?? "execution");
    deprioritizedTypes.add(tt);
    const current = params.taskTypeWeights.get(tt) ?? 1;
    params.taskTypeWeights.set(tt, current * 0.3);
  }

  for (const tt of params.intelligence.avoidedTaskTypes) {
    deprioritizedTypes.add(tt);
    const current = params.taskTypeWeights.get(tt) ?? 1;
    params.taskTypeWeights.set(tt, current * 0.01);
  }

  if (params.intelligence.recoverySuccessActive) {
    for (const [tt, weight] of params.taskTypeWeights) {
      if (deprioritizedTypes.has(tt)) {
        params.taskTypeWeights.set(tt, Math.min(1, weight + 0.1));
      }
    }
  }

  return { difficultyCap, deprioritizedTypes };
}

/** Weighted random pick helper — deprioritize without eliminating (Phase 8 law). */
export function applyTaskTypeWeights(
  candidates: Array<{ task_type: string }>,
  weights: Map<string, number>,
): Array<{ task_type: string }> {
  return [...candidates].sort((a, b) => {
    const wa = weights.get(a.task_type) ?? 1;
    const wb = weights.get(b.task_type) ?? 1;
    return wb - wa;
  });
}

export function frictionScoreForType(frictionMap: FrictionMap, taskType: string): number {
  const direct = frictionMap[taskType];
  if (direct) return direct.frictionScore;
  return 0;
}

export { computeFrictionScore };
