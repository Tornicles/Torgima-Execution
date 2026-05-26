import type { ExecutionProfile, IdentityInput, PersonalityDimensions } from "../contracts/types.js";

export class PersonalityEngine {
  dimensions(input: IdentityInput): PersonalityDimensions {
    const signals = input.signals ?? {};
    const life = input.life ?? {};
    return {
      speed: typeof signals.momentum === "number" ? signals.momentum : 0.55,
      certainty: typeof signals.confidence === "number" ? signals.confidence : 0.6,
      energy: typeof life.energyLevel === "number" ? life.energyLevel : 0.5,
      social: typeof life.socialNeed === "number" ? life.socialNeed : 0.45,
      structure: typeof input.blueprint?.structure === "number" ? input.blueprint.structure : 0.6,
      adaptability: input.feedback?.flexible ? 0.8 : 0.5,
    };
  }

  /** Profile behavior — do not stereotype. */
  executionProfile(dims: PersonalityDimensions): ExecutionProfile {
    if (dims.speed > 0.7 && dims.certainty < 0.5) return "Explorer";
    if (dims.structure > 0.7 && dims.certainty > 0.65) return "Strategist";
    if (dims.energy > 0.65 && dims.speed > 0.55) return "Operator";
    if (dims.adaptability > 0.7 && dims.social > 0.55) return "Creator";
    return "Builder";
  }
}

export const personalityEngine = new PersonalityEngine();
