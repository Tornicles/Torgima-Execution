import { randomUUID } from "node:crypto";
import { teamPolicy } from "../policy/TeamPolicy.js";
import { teamIdentity } from "../team-identity/TeamIdentity.js";
import { collaborationEngine } from "../collaboration/CollaborationEngine.js";
import { coordinationEngine } from "../coordination/CoordinationEngine.js";
import { consensusEngine } from "../consensus/ConsensusEngine.js";
import { humanAgentCollaboration } from "../human-agent/HumanAgentCollaboration.js";
import { teamExecution } from "../execution/TeamExecution.js";
import { alignmentEngine } from "../alignment/AlignmentEngine.js";
import { teamHealth } from "../health/TeamHealth.js";
import { teamMemory } from "../team-memory/TeamMemory.js";
import { persistTeam, listTeamHistory } from "../teamData.js";
import type {
  AlignmentResult,
  ConsensusResult,
  TeamHealthResult,
  TeamInput,
  TeamOutput,
} from "../contracts/types.js";
import { logger } from "../../../lib/logger.js";

/**
 * BTIE — collective intelligence. Teams are first-class units.
 */
export class TeamEngine {
  async create(input: TeamInput): Promise<TeamOutput> {
    return this.runCycle({ ...input, teamId: input.teamId ?? randomUUID() });
  }

  async align(input: TeamInput): Promise<AlignmentResult> {
    const full = await this.runCycle(input);
    return {
      alignment: full.alignment,
      conflicts: [],
      recommendations: [full.recommendation],
    };
  }

  async consensus(input: TeamInput, proposal?: string): Promise<ConsensusResult> {
    const policy = teamPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Team policy violation: ${policy.violations.join("; ")}`);
    }
    return consensusEngine.decide(input, proposal);
  }

  async health(input: TeamInput): Promise<TeamHealthResult> {
    const full = await this.runCycle(input);
    return full.health ?? teamHealth.measure(input, 0.2);
  }

  async memory(teamId: string) {
    return teamMemory.recall(teamId);
  }

  async history(blueprintId: string, limit?: number) {
    return listTeamHistory(blueprintId, limit);
  }

  formatTeamContext(output: TeamOutput): string {
    return [
      `Team: ${output.teamState.memberCount} members (${output.teamState.humanCount} human, ${output.teamState.agentCount} agent)`,
      `Alignment ${Math.round(output.alignment * 100)}%`,
      output.health ? `Health ${output.health.score}/100 (${output.health.action})` : "",
      output.consensus ? `Consensus: ${output.consensus.decision.slice(0, 80)}` : "",
      output.recommendation.slice(0, 100),
    ]
      .filter(Boolean)
      .join("\n");
  }

  async validateBeforeDecision(input: TeamInput): Promise<{ allowed: boolean; reason?: string; output?: TeamOutput }> {
    const output = await this.runCycle(input);

    if (output.health?.action === "escalate") {
      return {
        allowed: false,
        reason: "Team health requires escalation before decision",
        output,
      };
    }

    if (output.alignment < 0.4) {
      return {
        allowed: false,
        reason: "Team alignment too low — reconcile before decision",
        output,
      };
    }

    if (output.execution && output.execution.blockers.length > 0) {
      return {
        allowed: false,
        reason: `Team blockers: ${output.execution.blockers.join(", ")}`,
        output,
      };
    }

    return { allowed: true, output };
  }

  private async runCycle(input: TeamInput): Promise<TeamOutput> {
    const sessionId = randomUUID();
    const teamId = input.teamId ?? randomUUID();

    const policy = teamPolicy.validate(input);
    if (!policy.allowed) {
      throw new Error(`Team policy violation: ${policy.violations.join("; ")}`);
    }

    const members = input.members ?? [];
    const humans = members.filter((m) => !m.isAgent);
    const agents = members.filter((m) => m.isAgent);
    const owner = members.find((m) => m.role === "OWNER" || m.role === "owner");

    const teamState = {
      memberCount: members.length,
      humanCount: humans.length,
      agentCount: agents.length,
      ownerId: owner?.userId,
    };

    const ti = teamIdentity.build(input);
    const coordination = coordinationEngine.optimize(input);
    const collaboration = collaborationEngine.analyze(input);
    void collaboration;
    const ha = humanAgentCollaboration.evaluate(input);
    const alignResult = alignmentEngine.track(input, ti.health);
    const consensus = consensusEngine.decide(input);
    const execution = teamExecution.manage(input);
    const healthResult = teamHealth.measure(input, coordination.friction);

    const capacity = {
      total: Math.max(1, members.length) * 5,
      allocated: (input.projects ?? []).length * 2,
      available: Math.max(0, members.length * 5 - (input.projects ?? []).length * 2),
    };

    const recommendation = [
      `Owner: ${ha.ownership}`,
      ...alignResult.recommendations.slice(0, 1),
      ...coordination.actions.slice(0, 1),
      ha.approvalRequired ? "Human approval required for agent actions" : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const output: TeamOutput = {
      sessionId,
      teamId,
      teamState,
      alignment: alignResult.alignment,
      capacity,
      recommendation,
      teamIdentity: ti,
      coordination,
      consensus,
      execution,
      health: healthResult,
    };

    teamMemory.store(teamId, output);

    try {
      await persistTeam(output, input.blueprintId, input.name ?? "Blueprint Team");
    } catch (err) {
      logger.warn({ err, sessionId }, "[TeamEngine] persist skipped");
    }

    return output;
  }
}

export const teamEngine = new TeamEngine();
