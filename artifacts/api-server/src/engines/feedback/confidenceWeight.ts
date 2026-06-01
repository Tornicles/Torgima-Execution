export type ConfidenceWeightResult = {
  weight: number;
  confidence: "high" | "medium" | "low";
  flagged: boolean;
  flag_reason?: string;
};

/** Automated confidence weight — user never sets this. */
export function calculateConfidenceWeight(input: {
  score: number;
  reflection: string;
  completion: string;
  proof_json?: Record<string, unknown> | null;
  started_at: Date | null;
  proofRequired?: boolean;
  proofNormalized?: number;
}): ConfidenceWeightResult {
  let weight = 1.0;
  let flagged = false;
  let flag_reason: string | undefined;

  const ref = input.reflection.trim();

  if (ref.length < 30) weight -= 0.2;

  if (input.score >= 9 && ref.length < 50) {
    weight -= 0.3;
    flagged = true;
    flag_reason = "HIGH_SCORE_WEAK_REFLECTION";
  }

  if (input.score === 10 && ref.length < 100) weight -= 0.2;

  if (input.completion === "completed" && input.score <= 2) weight -= 0.2;

  if (input.proofRequired && input.proofNormalized != null) {
    weight *= Math.max(0.35, 0.45 + 0.55 * input.proofNormalized);
  }

  const hours_after = input.started_at
    ? (Date.now() - input.started_at.getTime()) / 3600000
    : 0;
  if (hours_after > 12) weight *= 0.9;

  weight = Math.max(0.3, Math.min(1.0, weight));

  const confidence: ConfidenceWeightResult["confidence"] =
    weight >= 0.85 ? "high" : weight >= 0.65 ? "medium" : "low";

  return { weight, confidence, flagged, flag_reason };
}
