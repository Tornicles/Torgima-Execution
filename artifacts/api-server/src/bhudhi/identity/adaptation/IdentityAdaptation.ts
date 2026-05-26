import type { AdaptationResult, IdentityInput, MotivationResult, PersonalityDimensions } from "../contracts/types.js";
import type { ExecutionProfile } from "../contracts/types.js";

export class IdentityAdaptation {
  adapt(
    input: IdentityInput,
    profile: ExecutionProfile,
    motivation: MotivationResult,
    personality: PersonalityDimensions,
  ): AdaptationResult {
    const pace = personality.speed > 0.65 ? "accelerated" : personality.speed < 0.4 ? "gentle" : "steady";
    const structure = personality.structure > 0.6 ? "structured milestones" : "flexible checkpoints";

    let communication = "Direct, evidence-based coaching";
    if (motivation.motivationType === "fear") communication = "Calm, stabilizing, safety-first language";
    if (motivation.motivationType === "curiosity") communication = "Exploratory questions and options";
    if (profile === "Creator") communication = "Inspirational with creative framing";

    let tasks = `${profile} task batching — ${pace} pace`;
    if (input.feedback?.burnout) tasks = "Reduced load — recovery-oriented task set";

    let timelines = structure;
    if (motivation.recommendations.includes("recover")) timelines = "Extended timelines with rest buffers";

    let execution = `${profile} execution mode`;
    if (input.execution?.blocked) execution = "Pause execution — identity protection active";

    return { communication, tasks, timelines, execution };
  }
}

export const identityAdaptation = new IdentityAdaptation();
