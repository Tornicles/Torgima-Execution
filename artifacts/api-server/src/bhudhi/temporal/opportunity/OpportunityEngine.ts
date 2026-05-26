import type { OpportunityResult, TemporalInput } from "../contracts/types.js";

export class OpportunityEngine {
  detect(input: TemporalInput): OpportunityResult {
    const now = Date.now();
    const deadlines = input.deadlines ?? [];
    const nearest = deadlines
      .map((d) => ({ ...d, ts: new Date(d.at).getTime() }))
      .filter((d) => !Number.isNaN(d.ts))
      .sort((a, b) => a.ts - b.ts)[0];

    let score = 55;
    let probability = 0.5;
    let window = "open_window";
    let recommendedAction = "Schedule within next acceptable window";

    if (nearest) {
      const daysLeft = (nearest.ts - now) / 86400000;
      if (daysLeft < 2) {
        score = 90;
        probability = 0.85;
        window = "urgent_deadline";
        recommendedAction = `Act before ${nearest.label} expires`;
      } else if (daysLeft < 14) {
        score = 70;
        probability = 0.65;
        window = "compounding_window";
        recommendedAction = "Compound progress before deadline pressure";
      }
    }

    if (input.signals?.global === "power") {
      score = Math.min(100, score + 15);
      probability = Math.min(0.95, probability + 0.1);
    }

    return { window, probability, score, recommendedAction };
  }
}

export const opportunityEngine = new OpportunityEngine();
