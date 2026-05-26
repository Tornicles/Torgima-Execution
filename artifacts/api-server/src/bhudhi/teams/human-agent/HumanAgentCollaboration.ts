import type { HumanAgentMode, TeamInput } from "../contracts/types.js";

export class HumanAgentCollaboration {
  evaluate(input: TeamInput): {
    mode: HumanAgentMode;
    ownership: string;
    trust: number;
    approvalRequired: boolean;
  } {
    const members = input.members ?? [];
    const agents = members.filter((m) => m.isAgent);
    const humans = members.filter((m) => !m.isAgent);

    let mode: HumanAgentMode = "human-led";
    if (agents.length > humans.length) mode = "agent-assisted";
    if (input.execution?.agentOperated === true) mode = "agent-operated";
    if (input.execution?.reviewRequired === true) mode = "review-required";

    const owner =
      members.find((m) => m.role === "OWNER")?.userId ?? humans[0]?.userId ?? "unassigned";
    const trust =
      typeof input.identity?.trust === "number"
        ? input.identity.trust
        : agents.length > 0
          ? 0.65
          : 0.85;

    return {
      mode,
      ownership: owner,
      trust,
      approvalRequired: mode === "review-required" || mode === "agent-operated",
    };
  }
}

export const humanAgentCollaboration = new HumanAgentCollaboration();
