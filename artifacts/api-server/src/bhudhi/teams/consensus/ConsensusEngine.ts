import type { ConsensusModel, ConsensusResult, TeamInput } from "../contracts/types.js";

export class ConsensusEngine {
  decide(input: TeamInput, proposal?: string): ConsensusResult {
    const model = input.consensusModel ?? "owner";
    const members = input.members ?? [];
    const weights = members.map((m) => m.weight ?? (m.role === "OWNER" ? 2 : 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

    const decision = proposal ?? (input.execution?.proposal as string) ?? "Proceed with shared execution plan";
    let agreement = 0.7;
    let confidence = 0.65;

    switch (model) {
      case "owner": {
        const owner = members.find((m) => m.role === "OWNER" || m.role === "owner");
        agreement = owner ? 0.85 : 0.6;
        confidence = 0.8;
        break;
      }
      case "majority":
        agreement = members.length > 0 ? Math.min(1, 0.5 + members.length * 0.1) : 0.5;
        confidence = 0.7;
        break;
      case "weighted":
        agreement = Math.min(1, totalWeight / (members.length * 2 || 1));
        confidence = 0.75;
        break;
      case "unanimous":
        agreement = input.execution?.dissent === true ? 0.4 : 0.95;
        confidence = agreement > 0.9 ? 0.9 : 0.5;
        break;
      case "advisor":
        agreement = 0.6;
        confidence = 0.55;
        break;
    }

    if (input.execution?.blocked === true) {
      agreement *= 0.5;
      confidence *= 0.6;
    }

    return { decision, confidence, agreement, model };
  }
}

export const consensusEngine = new ConsensusEngine();
