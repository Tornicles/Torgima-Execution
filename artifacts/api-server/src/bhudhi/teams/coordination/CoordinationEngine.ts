import type { CoordinationResult, TeamInput } from "../contracts/types.js";

export class CoordinationEngine {
  optimize(input: TeamInput): CoordinationResult {
    const members = input.members ?? [];
    const projects = input.projects ?? [];
    const load = members.length > 0 ? projects.length / members.length : 0;
    const switching = projects.length > members.length ? 0.4 : 0.15;
    const friction = Math.min(1, load * 0.3 + switching);
    const coordinationScore = Math.max(0, 1 - friction);

    const actions: string[] = [];
    if (friction > 0.5) actions.push("Reduce context switching — batch dependencies");
    if (load > 2) actions.push("Rebalance load across members");
    if (actions.length === 0) actions.push("Protect flow state — maintain current cadence");

    return { coordinationScore, friction, actions };
  }
}

export const coordinationEngine = new CoordinationEngine();
