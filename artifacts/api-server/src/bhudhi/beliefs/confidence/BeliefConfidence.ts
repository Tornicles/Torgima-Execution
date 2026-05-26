import type { BeliefRecord } from "../contracts/types.js";

export class BeliefConfidence {
  aggregate(records: BeliefRecord[]): number {
    if (records.length === 0) return 0.3;
    const weighted = records.map((r) => {
      const evBoost =
        r.evidence.length > 0
          ? r.evidence.reduce((s, e) => s + e.evidenceScore, 0) / r.evidence.length
          : 0.4;
      return Math.min(r.confidence, evBoost + 0.05);
    });
    return weighted.reduce((a, b) => a + b, 0) / weighted.length;
  }

  /** Confidence cannot exceed evidence. */
  capByEvidence(score: number, records: BeliefRecord[]): number {
    const maxEvidence =
      records.length > 0
        ? Math.max(...records.flatMap((r) => r.evidence.map((e) => e.evidenceScore)), 0.5)
        : 0.5;
    return Math.min(score, maxEvidence + 0.15);
  }
}

export const beliefConfidence = new BeliefConfidence();
