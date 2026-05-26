import type { DecisionConfidenceResult, DecisionInput, ConfidenceLevel } from "../contracts/types.js";

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.95) return "CERTAIN";
  if (score >= 0.85) return "VERY_HIGH";
  if (score >= 0.7) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

export class DecisionConfidence {
  assess(input: DecisionInput, optionConfidence: number, evidenceCount: number): DecisionConfidenceResult {
    const data = Math.min(1, evidenceCount / 5);
    const simulation = input.simulation ? 0.75 : 0.45;
    const memory = (input.memory?.length ?? 0) > 0 ? 0.7 : 0.4;
    const agreement = optionConfidence;
    const evidence = Math.min(1, (input.constraints?.length ?? 0) * 0.1 + data);

    const raw = (data + simulation + memory + agreement + evidence) / 5;
    const capped = Math.min(raw, evidence, optionConfidence);

    return {
      level: levelFromScore(capped),
      score: capped,
      dimensions: { data, simulation, memory, agreement, evidence },
    };
  }
}

export const decisionConfidence = new DecisionConfidence();
