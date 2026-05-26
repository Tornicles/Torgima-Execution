import type { TeamIdentityResult, TeamInput } from "../contracts/types.js";

export class TeamIdentity {
  build(input: TeamInput): TeamIdentityResult {
    const mission =
      (input.organization?.vision as string) ??
      (input.identity?.mission as string) ??
      "Collective execution with shared accountability";
    const values = (input.identity?.values as string[]) ?? ["clarity", "ownership", "learning"];
    const strengths = ["coordination", "decision traceability"];
    const blindspots: string[] = [];
    if ((input.members ?? []).some((m) => m.isAgent)) {
      blindspots.push("human-agent handoff clarity");
    }
    const workingStyle = (input.identity?.workingStyle as string) ?? "async-first with sync gates";

    const drift = input.identity?.driftDetected === true ? 0.35 : 0.08;
    const health = Math.max(0, 1 - drift);

    return {
      identity: { mission, values, strengths, blindspots, workingStyle },
      health,
      drift,
    };
  }
}

export const teamIdentity = new TeamIdentity();
