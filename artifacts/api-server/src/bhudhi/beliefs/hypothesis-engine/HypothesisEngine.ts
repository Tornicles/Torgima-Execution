import type { BeliefInput, BeliefRecord, HypothesisClaim } from "../contracts/types.js";
import { beliefRegistry } from "../belief-registry/BeliefRegistry.js";

export class HypothesisEngine {
  generate(input: BeliefInput, existing: BeliefRecord[]): BeliefRecord[] {
    const claims: HypothesisClaim[] = [
      {
        claim: "Current strategy remains optimal under unchanged signals",
        support: 0.6,
        risk: 0.35,
        testPlan: "Compare execution outcomes vs forecast at 7d horizon",
      },
      {
        claim: "Memory context may be stale relative to live signals",
        support: 0.45,
        risk: 0.5,
        testPlan: "Revalidate memory against latest signal snapshot",
      },
      {
        claim: "Alternative truth: priority order should be re-ranked",
        support: 0.4,
        risk: 0.55,
        testPlan: "Run simulation with inverted priority weights",
      },
    ];

    if (input.simulation) {
      claims.push({
        claim: "Simulation branch diverges from baseline prediction",
        support: 0.55,
        risk: 0.4,
        testPlan: "Replay simulation with counterfactual inputs",
      });
    }

    return claims.map((c) =>
      beliefRegistry.create({
        type: "hypothesis",
        statement: `${c.claim} (test: ${c.testPlan})`,
        origin: "hypothesis-engine",
        state: "HYPOTHESIZED",
        confidence: c.support * (1 - c.risk * 0.3),
        evidence: [
          {
            source: "simulation",
            reliability: c.support,
            recency: 0.8,
            agreement: 0.5,
            repeatability: 0.4,
            evidenceScore: c.support,
            strength: c.support > 0.6 ? "moderate" : "weak",
          },
        ],
      }),
    );
  }
}

export const hypothesisEngine = new HypothesisEngine();
