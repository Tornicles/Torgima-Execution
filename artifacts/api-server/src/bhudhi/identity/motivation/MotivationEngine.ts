import type { IdentityInput, MotivationResult, MotivationType } from "../contracts/types.js";

export class MotivationEngine {
  detect(input: IdentityInput): MotivationResult {
    let type: MotivationType = "purpose";
    const recommendations: string[] = [];

    if (input.feedback?.fear || input.signals?.global === "danger") {
      type = "fear";
      recommendations.push("recover", "protect");
    } else if (input.feedback?.curiosity || input.beliefs?.hypotheses) {
      type = "curiosity";
      recommendations.push("adapt", "accelerate");
    } else if (input.execution?.mastery) {
      type = "mastery";
      recommendations.push("accelerate");
    } else if (input.feedback?.reward) {
      type = "extrinsic";
      recommendations.push("adapt");
    } else if (input.life?.meaningAlignment) {
      type = "intrinsic";
      recommendations.push("protect", "reflect");
    }

    const stability =
      type === "fear"
        ? 0.35
        : type === "purpose" || type === "intrinsic"
          ? 0.75
          : 0.55;

    if (input.feedback?.burnout) recommendations.push("recover");

    return {
      motivationType: type,
      stability,
      recommendations: [...new Set(recommendations)],
    };
  }
}

export const motivationEngine = new MotivationEngine();
