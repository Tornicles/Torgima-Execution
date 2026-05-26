import type { ComparisonResult, ComparisonVerdict, MeasurementResult } from "../contracts/types.js";

export class ComparisonEngine {
  compare(
    control: MeasurementResult,
    variants: Array<{ groupKey: string; measurement: MeasurementResult }>,
  ): ComparisonResult & { rankings: Array<{ groupKey: string; delta: number }> } {
    const rankings = [
      { groupKey: "control", delta: 0 },
      ...variants.map((v) => ({ groupKey: v.groupKey, delta: v.measurement.delta })),
    ].sort((a, b) => b.delta - a.delta);

    const best = rankings[0]!;
    const controlRank = rankings.find((r) => r.groupKey === "control");

    let verdict: ComparisonVerdict = "inconclusive";
    if (best.groupKey !== "control" && best.delta > 0.03 && controlRank) {
      const margin = best.delta - (controlRank.delta ?? 0);
      verdict = margin > 0.05 ? "winner" : "neutral";
    } else if (best.groupKey === "control") {
      verdict = variants.every((v) => v.measurement.delta < 0) ? "loser" : "neutral";
    }

    return {
      verdict,
      winner: verdict === "winner" ? best.groupKey : undefined,
      loser: verdict === "loser" ? variants[0]?.groupKey : undefined,
      summary:
        verdict === "winner"
          ? `${best.groupKey} improved vs control (Δ=${best.delta.toFixed(3)})`
          : verdict === "inconclusive"
            ? "Difference ≠ improvement — more data needed"
            : "No clear winner",
      rankings,
    };
  }
}

export const comparisonEngine = new ComparisonEngine();
