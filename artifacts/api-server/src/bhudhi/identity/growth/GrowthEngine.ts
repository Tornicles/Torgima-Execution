import type { GrowthResult, IdentityInput } from "../contracts/types.js";

export class GrowthEngine {
  assess(input: IdentityInput, maturity: number, stability: number): GrowthResult {
    const currentState = this.stage(maturity);
    const nextIdentity = this.nextStage(maturity);
    const transitions: string[] = [];

    if (maturity < 0.4) transitions.push("Establish consistent execution habits");
    if (maturity >= 0.4 && maturity < 0.7) transitions.push("Deepen purpose alignment");
    if (maturity >= 0.7) transitions.push("Mentor-level contribution — protect identity gains");

    if (input.feedback?.breakthrough) transitions.push("Integrate breakthrough into identity narrative");
    if (stability < 0.4) transitions.unshift("Stabilize before accelerating growth");

    return {
      currentState,
      nextIdentity,
      recommendedTransitions: transitions,
      maturity,
      stability,
    };
  }

  private stage(maturity: number): string {
    if (maturity < 0.25) return "FORMING";
    if (maturity < 0.5) return "DEVELOPING";
    if (maturity < 0.75) return "ESTABLISHED";
    return "EVOLVING";
  }

  private nextStage(maturity: number): string {
    if (maturity < 0.25) return "DEVELOPING";
    if (maturity < 0.5) return "ESTABLISHED";
    if (maturity < 0.75) return "EVOLVING";
    return "TRANSCENDING";
  }
}

export const growthEngine = new GrowthEngine();
