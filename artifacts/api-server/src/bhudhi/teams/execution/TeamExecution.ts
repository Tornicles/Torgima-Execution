import type { TeamExecutionResult, TeamInput } from "../contracts/types.js";

export class TeamExecution {
  manage(input: TeamInput): TeamExecutionResult {
    const projects = input.projects ?? [];
    const completed = projects.filter((p) => p.status === "done").length;
    const blockers: string[] = [];

    if (input.execution?.blocked === true) blockers.push("execution_blocked");
    if ((input.members ?? []).length === 0) blockers.push("no_members");
    if (input.execution?.dependencyFailure === true) blockers.push("dependency_failure");

    const completion = projects.length > 0 ? completed / projects.length : 0;
    const velocity =
      typeof input.execution?.velocity === "number"
        ? input.execution.velocity
        : Math.min(1, completion + 0.2);

    return { velocity, blockers, completion };
  }
}

export const teamExecution = new TeamExecution();
