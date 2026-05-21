/**
 * GAP G6 — difficulty recommendation and enforcement helpers.
 */

export const DIFFICULTY_ORDER = [
  "very_easy",
  "easy",
  "moderate",
  "hard",
  "very_hard",
] as const;

export type DifficultyLevel = (typeof DIFFICULTY_ORDER)[number];

export type OverallCapabilityLevel = "developing" | "capable" | "strong" | "elite";

export function deriveDifficultyRecommendation(
  executionQuality: number,
  consistency: number,
): DifficultyLevel {
  if (executionQuality >= 0.8 && consistency >= 0.8) return "hard";
  if (executionQuality >= 0.6 && consistency >= 0.6) return "moderate";
  if (executionQuality < 0.3 || consistency < 0.3) return "very_easy";
  return "easy";
}

export function deriveOverallLevel(
  executionQuality: number,
  consistency: number,
): OverallCapabilityLevel {
  if (executionQuality >= 0.85 && consistency >= 0.85) return "elite";
  if (executionQuality >= 0.7 && consistency >= 0.7) return "strong";
  if (executionQuality >= 0.5 && consistency >= 0.5) return "capable";
  return "developing";
}

export function overallLevelToDbLevel(
  overall: OverallCapabilityLevel,
): "beginner" | "operator" | "advanced" | "lead" {
  const map: Record<OverallCapabilityLevel, "beginner" | "operator" | "advanced" | "lead"> = {
    developing: "beginner",
    capable: "operator",
    strong: "advanced",
    elite: "lead",
  };
  return map[overall];
}

export function minDifficulty(a: string, b: string): DifficultyLevel {
  const ai = DIFFICULTY_ORDER.indexOf(a as DifficultyLevel);
  const bi = DIFFICULTY_ORDER.indexOf(b as DifficultyLevel);
  const safeA = ai >= 0 ? ai : 1;
  const safeB = bi >= 0 ? bi : 2;
  return DIFFICULTY_ORDER[Math.min(safeA, safeB)] ?? "easy";
}

/** LAW 2 — LOW capability cannot exceed moderate; HIGH may scale toward hard. */
export function enforceCapabilityDifficulty(params: {
  difficultyRecommendation: string;
  difficultyCap: string;
  capabilityLevel: string;
  executionQuality: number;
  consistency: number;
}): DifficultyLevel {
  let chosen = minDifficulty(params.difficultyRecommendation, params.difficultyCap);

  const lowCapability =
    params.capabilityLevel === "beginner" ||
    params.executionQuality < 0.45 ||
    params.consistency < 0.4;

  if (lowCapability) {
    chosen = minDifficulty(chosen, "moderate");
  }

  return chosen;
}
