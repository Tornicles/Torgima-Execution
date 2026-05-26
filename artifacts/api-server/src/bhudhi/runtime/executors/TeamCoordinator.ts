import type { TeamInput } from "../../teams/contracts/types.js";
import { teamExecution } from "../../teams/execution/TeamExecution.js";
import { ExecutionRuntime } from "../ExecutionRuntime.js";

export class TeamCoordinator {
  constructor(private runtime: ExecutionRuntime = new ExecutionRuntime()) {}

  async coordinate(blueprintId: string, team: Record<string, unknown>) {
    const name = String(team.name ?? "Team");
    const executionId = await this.runtime.start({
      blueprintId,
      executionType: "team",
      action: `Coordinate team: ${name}`,
      payload: team,
    });

    try {
      await this.runtime.updateStatus(executionId, "running", 0);

      const members = (team.members as Array<Record<string, unknown>>) ?? [];
      const assignments = members.map((member) => ({
        memberId: member.id ?? member.memberId,
        tasks: [{ title: "Execute assignment" }],
      }));

      const execResult = teamExecution.manage({
        blueprintId,
        teamId: String(team.id ?? "team-1"),
        name: String(team.name ?? "Team"),
        members: members.map((m) => ({
          userId: String(m.userId ?? m.id ?? m.memberId ?? "m1"),
          role: String(m.role ?? "member"),
        })),
        projects: (team.projects as TeamInput["projects"]) ?? [],
        execution: team.execution as Record<string, unknown> | undefined,
      });

      await this.runtime.updateStatus(executionId, "running", 66);

      const results = assignments.map((a) => ({ ...a, completed: true }));

      await this.runtime.complete(executionId, true, "Team coordination complete", {
        assignments,
        results,
        execution: execResult,
      });

      return { success: true, executionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runtime.complete(executionId, false, `Team coordination failed: ${message}`, {
        error: message,
      });
      throw err;
    }
  }
}

export const teamCoordinator = new TeamCoordinator();
