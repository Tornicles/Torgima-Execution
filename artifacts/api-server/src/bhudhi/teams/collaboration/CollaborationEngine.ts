import type { TeamInput } from "../contracts/types.js";

export class CollaborationEngine {
  analyze(input: TeamInput): { handoffs: number; contributions: string[]; actions: string[] } {
    const members = input.members ?? [];
    const projects = input.projects ?? [];
    const handoffs = Math.max(0, projects.length - 1);
    const contributions = members.map((m) => `${m.userId}:${m.role ?? "member"}`);
    const actions: string[] = [];
    if (handoffs > 2) actions.push("pair");
    if (members.length > 5) actions.push("delegate");
    if (projects.length > 1) actions.push("merge");
    if (actions.length === 0) actions.push("connect");
    return { handoffs, contributions, actions };
  }
}

export const collaborationEngine = new CollaborationEngine();
