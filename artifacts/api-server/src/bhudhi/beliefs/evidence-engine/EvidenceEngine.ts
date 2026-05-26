import type { BeliefInput, BeliefRecord, EvidenceItem, EvidenceSource } from "../contracts/types.js";

export class EvidenceEngine {
  score(source: EvidenceSource, payload?: Record<string, unknown>): EvidenceItem {
    const reliability = this.clamp(payload?.reliability ?? this.defaultReliability(source));
    const recency = this.clamp(payload?.recency ?? 0.7);
    const agreement = this.clamp(payload?.agreement ?? 0.6);
    const repeatability = this.clamp(payload?.repeatability ?? 0.5);
    const evidenceScore = (reliability + recency + agreement + repeatability) / 4;
    const strength: EvidenceItem["strength"] =
      evidenceScore >= 0.75 ? "strong" : evidenceScore >= 0.5 ? "moderate" : "weak";

    return { source, reliability, recency, agreement, repeatability, evidenceScore, strength };
  }

  attachToBeliefs(records: BeliefRecord[], input: BeliefInput): BeliefRecord[] {
    const sources: EvidenceSource[] = [];
    if (input.memory) sources.push("memory");
    if (input.research) sources.push("research");
    if (input.execution) sources.push("execution");
    if (input.simulation) sources.push("simulation");
    if (input.feedback) sources.push("feedback");
    if (input.signals) sources.push("life");

    return records.map((r) => {
      const originSource = (r.origin as EvidenceSource) || sources[0] || "memory";
      const ev = this.score(originSource);
      const merged = r.evidence.length > 0 ? r.evidence : [ev];
      const avgScore = merged.reduce((s, e) => s + e.evidenceScore, 0) / merged.length;
      return {
        ...r,
        evidence: merged,
        confidence: Math.min(r.confidence, avgScore + 0.1),
      };
    });
  }

  /** Facts must have evidence — downgrade if missing. */
  enforceFactEvidence(records: BeliefRecord[]): BeliefRecord[] {
    return records.map((r) => {
      if (r.type !== "fact") return r;
      if (r.evidence.length === 0) {
        return {
          ...r,
          type: "assumption" as const,
          state: "ASSUMED",
          statement: `[Unverified] ${r.statement}`,
          confidence: r.confidence * 0.6,
        };
      }
      return r;
    });
  }

  private defaultReliability(source: EvidenceSource): number {
    const map: Record<EvidenceSource, number> = {
      memory: 0.65,
      research: 0.75,
      execution: 0.85,
      simulation: 0.55,
      feedback: 0.7,
      life: 0.6,
    };
    return map[source] ?? 0.5;
  }

  private clamp(n: unknown): number {
    const v = typeof n === "number" ? n : 0.5;
    return Math.min(1, Math.max(0, v));
  }
}

export const evidenceEngine = new EvidenceEngine();
