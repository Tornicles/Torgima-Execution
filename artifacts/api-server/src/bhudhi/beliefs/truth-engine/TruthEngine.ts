import type { BeliefRecord, TruthAssessment, TruthCategory } from "../contracts/types.js";

const TRUTH_TTL_DAYS: Record<TruthCategory, number> = {
  LOCAL: 7,
  GLOBAL: 30,
  TEMPORARY: 3,
  PERMANENT: 365,
};

export class TruthEngine {
  assess(record: BeliefRecord, conflicts: string[] = []): TruthAssessment {
    const evidenceAvg =
      record.evidence.length > 0
        ? record.evidence.reduce((s, e) => s + e.evidenceScore, 0) / record.evidence.length
        : record.confidence * 0.5;

    const truthScore = Math.min(1, evidenceAvg * record.confidence);
    const stability = record.state === "VALIDATED" ? 0.85 : record.state === "OBSERVED" ? 0.7 : 0.45;
    const certainty = truthScore * stability;
    const category = this.categorize(record);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TRUTH_TTL_DAYS[category]);

    return {
      truthScore,
      stability,
      certainty,
      category,
      conflicts,
      expiresAt,
    };
  }

  /** Truth expires — mark stale beliefs. */
  isExpired(expiresAt?: Date | null): boolean {
    if (!expiresAt) return false;
    return expiresAt.getTime() < Date.now();
  }

  private categorize(record: BeliefRecord): TruthCategory {
    if (record.origin === "signals") return "GLOBAL";
    if (record.type === "hypothesis") return "TEMPORARY";
    if (record.state === "VALIDATED") return "PERMANENT";
    return "LOCAL";
  }
}

export const truthEngine = new TruthEngine();
