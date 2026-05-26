import type { BeliefRecord, ContradictionResult, DriftResult } from "../contracts/types.js";

export class BeliefDrift {
  detect(records: BeliefRecord[], contradictions: ContradictionResult[]): DriftResult {
    const signals: string[] = [];

    const stale = records.filter((r) => r.memoryClass === "EXPIRED" || r.state === "DEPRECATED");
    if (stale.length > 0) signals.push("truth_erosion");

    const hallucination = records.filter(
      (r) => r.type === "fact" && r.evidence.length === 0 && r.confidence > 0.7,
    );
    if (hallucination.length > 0) signals.push("hallucination");

    const bias = records.filter(
      (r) => r.origin === "assumption" && r.confidence > 0.8 && r.evidence.length < 2,
    );
    if (bias.length > 0) signals.push("bias");

    if (contradictions.length >= 2) signals.push("memory_pollution");

    const detected = signals.length > 0;
    let action: DriftResult["action"] = "none";
    if (signals.includes("hallucination") || contradictions.some((c) => c.action === "escalate")) {
      action = "governance";
    } else if (detected) {
      action = "revalidation";
    }
    if (signals.includes("memory_pollution") && contradictions.length >= 3) {
      action = "rollback";
    }

    return { detected, signals, action };
  }
}

export const beliefDrift = new BeliefDrift();
