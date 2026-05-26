import type { DiscoveredCapability, ExpansionInput } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class CapabilityDiscovery {
  detect(input: ExpansionInput, seed: string): DiscoveredCapability[] {
    const candidates: DiscoveredCapability[] = [];
    const domains = ["validation", "execution", "simulation", "decision", "belief"];

    for (const domain of domains) {
      const score = seededUnit(seed, `disc-${domain}`);
      const hasSignal =
        input.results?.[domain] != null ||
        input.execution?.[domain] != null ||
        input.experiments?.active != null;

      if (score > 0.35 || hasSignal) {
        candidates.push({
          capability: `${domain}-pattern-reuse`,
          origin: domain,
          score: Math.min(0.95, score + (hasSignal ? 0.2 : 0)),
        });
      }
    }

    if (input.decisions?.recent) {
      candidates.push({
        capability: "decision-generalization",
        origin: "decisions",
        score: seededUnit(seed, "dec-gen") * 0.5 + 0.4,
      });
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  }
}

export const capabilityDiscovery = new CapabilityDiscovery();
