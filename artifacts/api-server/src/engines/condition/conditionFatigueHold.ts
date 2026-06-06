/**
 * Phase 8 — hold condition advancement while FATIGUE_RISK pattern is active.
 */

import { getActivePatterns } from "../pattern/PatternLearningEngine.js";

const CONDITION_LEVELS: Record<string, number> = {
  nothingness: 0,
  danger: 1,
  urgency: 2,
  stability: 3,
  power: 4,
  affluence: 5,
};

function patternSpecLabel(p: { pattern_type: string; evidence_json: unknown }): string {
  const evidence = (p.evidence_json ?? {}) as Record<string, unknown>;
  return String(evidence.spec_label ?? p.pattern_type ?? "");
}

export function isAdvancingCondition(previous: string, next: string): boolean {
  if (previous === next) return false;
  if (next === "power_change") return false;
  const prevRank = CONDITION_LEVELS[previous] ?? -1;
  const nextRank = CONDITION_LEVELS[next] ?? -1;
  if (prevRank < 0 || nextRank < 0) return false;
  return nextRank > prevRank;
}

export async function shouldHoldConditionForFatigue(params: {
  userId: string;
  blueprintId: string;
  previousCondition: string;
  proposedCondition: string;
}): Promise<boolean> {
  if (!isAdvancingCondition(params.previousCondition, params.proposedCondition)) {
    return false;
  }

  const patterns = await getActivePatterns(params.userId, params.blueprintId).catch(
    (): Awaited<ReturnType<typeof getActivePatterns>> => [],
  );
  return patterns.some(
    (p) => p.status === "active" && patternSpecLabel(p) === "FATIGUE_RISK",
  );
}
