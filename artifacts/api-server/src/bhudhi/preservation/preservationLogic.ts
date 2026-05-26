import type { DomainExpertiseResult, HypothesisTestResult } from "./types.js";

export interface ExecutionEventSlice {
  event_type: string;
  description: string | null;
  data: Record<string, unknown> | null;
  learnings_generated: string[] | null;
  frameworks_improved: string[] | null;
}

export function computeOutcomeAccuracy(
  actualOutcome: number,
  expectedOutcome: number,
): number {
  const error = Math.abs(actualOutcome - expectedOutcome);
  return Math.max(0, 1 - error / (expectedOutcome || 1));
}

export function extractLearningsFromEvents(events: ExecutionEventSlice[]): string[] {
  const learnings: string[] = [];

  const successful = events.filter((e) => e.data?.status === "completed");
  if (successful.length > 20) {
    learnings.push("High success rate indicates execution excellence");
  }

  const learningsGenerated = events.reduce(
    (sum, e) => sum + (e.learnings_generated?.length ?? 0),
    0,
  );
  if (learningsGenerated > 50) {
    learnings.push("Rapid learning velocity indicates adaptive capability");
  }

  const frameworksImproved = new Set(
    events.flatMap((e) => e.frameworks_improved ?? []),
  );
  if (frameworksImproved.size > 5) {
    learnings.push(
      `${frameworksImproved.size} frameworks improved - system is learning`,
    );
  }

  const taskTypes = new Set(
    events.map((e) => (e.description?.split(" ")[0] || "").trim()).filter(Boolean),
  );
  if (taskTypes.size > 10) {
    learnings.push("High execution variety indicates adaptability");
  }

  return learnings;
}

export function buildDomainExpertiseFromEvents(
  events: ExecutionEventSlice[],
): DomainExpertiseResult {
  const patterns: Record<string, number> = {};
  for (const e of events) {
    const key = e.description || "unknown";
    patterns[key] = (patterns[key] || 0) + 1;
  }

  const executionCount = events.length;
  return {
    patternsDiscovered: Object.keys(patterns).length,
    topPatterns: Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern),
    executionCount,
    expertise_level:
      executionCount < 10 ? "novice" : executionCount < 50 ? "intermediate" : "expert",
  };
}

export function testHypothesisStats(
  hypothesis: string,
  control: number,
  experimental: number,
): HypothesisTestResult {
  const effect = experimental - control;
  const stdError = Math.sqrt(
    Math.pow(control * 0.2, 2) + Math.pow(experimental * 0.2, 2),
  );
  const zScore = effect / (stdError || 1);
  const pValue = Math.exp(-0.5 * zScore * zScore);

  return {
    hypothesis,
    controlGroup: control,
    experimentalGroup: experimental,
    effectSize: effect,
    pValue,
    significant: pValue < 0.05,
    confidence: pValue < 0.05 ? "High" : "Low",
  };
}
