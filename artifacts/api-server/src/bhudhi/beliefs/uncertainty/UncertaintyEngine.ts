import type { BeliefRecord, UncertaintyResult } from "../contracts/types.js";

export class UncertaintyEngine {
  calculate(records: BeliefRecord[]): UncertaintyResult {
    const known = records
      .filter((r) => r.type === "fact" && r.evidence.length > 0)
      .map((r) => r.statement.slice(0, 80));
    const unknown = records
      .filter((r) => r.type === "hypothesis" || r.confidence < 0.5)
      .map((r) => r.statement.slice(0, 80));

    const avgConf =
      records.length > 0
        ? records.reduce((s, r) => s + r.confidence, 0) / records.length
        : 0.5;
    const certainty = Math.min(1, avgConf);
    const uncertainty = 1 - certainty;
    const ambiguity = records.filter((r) => r.state === "HYPOTHESIZED" || r.state === "ASSUMED").length;

    let recommendation = "Proceed with calibrated confidence";
    if (uncertainty > 0.6) recommendation = "Escalate uncertainty — gather evidence before strong claims";
    if (ambiguity >= 3) recommendation = "Multiple unresolved hypotheses — run validation cycle";

    return {
      certainty,
      uncertainty,
      known,
      unknown,
      recommendation,
    };
  }
}

export const uncertaintyEngine = new UncertaintyEngine();
