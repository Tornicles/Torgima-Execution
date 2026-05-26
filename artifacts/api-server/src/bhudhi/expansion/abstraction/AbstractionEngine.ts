import type { AbstractionResult, ExpansionInput } from "../contracts/types.js";
import { seededUnit } from "../lib/seededUnit.js";

export class AbstractionEngine {
  extract(input: ExpansionInput, seed: string): AbstractionResult {
    const evidence: string[] = [];
    let evidenceCount = 0;

    if (input.decisions) {
      evidence.push("Decision patterns observed");
      evidenceCount++;
    }
    if (input.experiments) {
      evidence.push("Experiment outcomes inform generalization");
      evidenceCount++;
    }
    if (input.results) {
      evidence.push("Execution results provide evidence");
      evidenceCount++;
    }
    if (input.beliefs) {
      evidence.push("Belief updates constrain abstraction");
      evidenceCount++;
    }

    const generalKnowledge =
      evidenceCount > 0
        ? [
            "Reusable capability emerges from repeatable cross-domain patterns",
            `Evidence strength: ${Math.round(seededUnit(seed, "abstract") * 100)}%`,
            ...evidence,
          ]
        : ["No abstraction without evidence — observe more cycles"];

    return { generalKnowledge, evidenceCount };
  }
}

export const abstractionEngine = new AbstractionEngine();
