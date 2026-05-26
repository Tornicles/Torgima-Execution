import type { IdentityInput, RankedValue, ValuesResult } from "../contracts/types.js";

const CORE_VALUES = ["family", "health", "growth", "wealth", "autonomy"] as const;

export class ValueEngine {
  assess(input: IdentityInput): ValuesResult {
    const ranked: RankedValue[] = CORE_VALUES.map((key, i) => ({
      key,
      rank: i + 1,
      weight: this.weightFor(key, input),
      protected: key === "health" || key === "family",
      temporary: key === "wealth" && Boolean(input.feedback?.shortTerm),
    }));

    ranked.sort((a, b) => b.weight - a.weight);
    ranked.forEach((v, i) => {
      v.rank = i + 1;
    });

    const conflicts: string[] = [];
    if (input.execution?.sacrificeHealth) {
      conflicts.push("Execution threatens protected value: health");
    }
    if (input.feedback?.burnout) {
      conflicts.push("Burnout signal conflicts with growth acceleration");
    }

    const protectionRules = ranked
      .filter((v) => v.protected)
      .map((v) => `Execution cannot destroy protected value: ${v.key}`);

    return { rankedValues: ranked, conflicts, protectionRules };
  }

  wouldViolateProtected(action: string, values: ValuesResult): boolean {
    const lower = action.toLowerCase();
    for (const v of values.rankedValues.filter((x) => x.protected)) {
      if (lower.includes(`harm ${v.key}`) || lower.includes(`sacrifice ${v.key}`)) {
        return true;
      }
    }
    return false;
  }

  private weightFor(key: string, input: IdentityInput): number {
    const base: Record<string, number> = {
      family: 0.85,
      health: 0.9,
      growth: 0.8,
      wealth: 0.6,
      autonomy: 0.75,
    };
    let w = base[key] ?? 0.5;
    if (key === "growth" && input.feedback?.learning) w += 0.1;
    if (key === "health" && input.life?.burnoutRisk) w += 0.15;
    return Math.min(1, w);
  }
}

export const valueEngine = new ValueEngine();
