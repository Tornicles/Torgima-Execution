import { db, debateLogs, agentConflictLogs } from "@workspace/db";
import { logger } from "../lib/logger.js";
import { reviewOutput } from "./agents/CriticAgent.js";
import type { BhudhiTriggerType } from "../types/bhudhi.js";

export type DebateType =
  | "DIRECTION_ANALYSIS"
  | "BLUEPRINT_RESTRUCTURE"
  | "HIGH_RISK_VALIDATION"
  | "AGENT_CONFLICT"
  | "FAILURE_CLASSIFICATION"
  | "SCALING_READINESS";

export interface DebateInput {
  topic: string;
  userId: string;
  triggerType: string;
  contextPacket: Record<string, unknown>;
  debateType: DebateType;
  feasibilityScore?: number;
  hardContradictionCount?: number;
}

export interface DebateRound {
  agent: string;
  position: string;
  confidence: number;
  evidence: string[];
  challenges: string[];
}

export interface DebateResult {
  consensusReached: boolean;
  finalVerdict: Record<string, unknown>;
  judgeRationale: string;
  winningPosition: string;
  dissents: string[];
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  debateSummary: string;
  debateLogId?: string;
}

export function shouldTriggerDebate(params: {
  triggerType: string;
  feasibilityScore?: number;
  hardContradictionCount?: number;
  agentConflict?: boolean;
}): boolean {
  if (params.agentConflict) return true;
  if ((params.feasibilityScore ?? 1) < 0.35) return true;
  if ((params.hardContradictionCount ?? 0) > 0) return true;
  if (params.triggerType === "REALITY_INTELLIGENCE" || params.triggerType === "DIRECTION_ANALYSIS") {
    return (params.feasibilityScore ?? 1) < 0.5;
  }
  return false;
}

export async function runDebate(input: DebateInput): Promise<DebateResult> {
  const start = Date.now();
  const goal = String(input.contextPacket["goal"] ?? input.topic).slice(0, 200);
  const feasibility = input.feasibilityScore ?? 0.5;

  const agentRounds: DebateRound[] = [
    {
      agent: "STRATEGY",
      position: `Pursue ${goal} with phased validation gates.`,
      confidence: Math.max(0.3, feasibility),
      evidence: ["Goal alignment", "Market context in packet"],
      challenges: [],
    },
    {
      agent: "BEHAVIORAL",
      position: "User must sustain weekly proof cadence before scaling scope.",
      confidence: 0.55,
      evidence: ["Execution patterns", "Capacity constraints"],
      challenges: ["Strategy may over-scope early"],
    },
    {
      agent: "BLUEPRINT",
      position: "Structure should prioritize demand proof before delivery expansion.",
      confidence: 0.6,
      evidence: ["Blueprint hierarchy", "Governance constraints"],
      challenges: ["Timeline pressure from strategy"],
    },
    {
      agent: "CRITIC",
      position:
        feasibility < 0.35 ?
          "Risk is too high without pivot — demand proof mandatory."
        : "Proceed with adjusted path and explicit risk flags.",
      confidence: feasibility < 0.35 ? 0.7 : 0.65,
      evidence: ["Feasibility score", "Contradiction count"],
      challenges: ["Optimism bias in strategy round"],
    },
  ];

  const rounds: DebateRound[] = [
    ...agentRounds,
    {
      agent: "JUDGE",
      position:
        feasibility < 0.35 ?
          "Recommend ADJUST: narrow scope and validate demand first."
        : "Recommend PROCEED with adjusted sequencing.",
      confidence: 0.72,
      evidence: agentRounds.flatMap(r => r.evidence).slice(0, 4),
      challenges: [],
    },
  ];

  const judgeRound = rounds[rounds.length - 1]!;
  const finalVerdict = {
    recommendation: judgeRound.position,
    feasibilityScore: feasibility,
    debateType: input.debateType,
  };

  const critic = await reviewOutput({
    output: {
      outputType: "state_explanation",
      contractVersion: "1.0",
      stateVersion: Number(input.contextPacket["stateVersion"] ?? 0),
      confidence: judgeRound.confidence >= 0.7 ? "HIGH" : "MEDIUM",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        explanation: judgeRound.position,
        recommendedAction: finalVerdict.recommendation,
      },
    },
    producingAgent: "JUDGE",
    triggerType: "STATE_EXPLANATION" as BhudhiTriggerType,
    promptContract: "state.explain.v1",
    userId: input.userId,
    worldStateVersion: Number(input.contextPacket["stateVersion"] ?? 0),
  });

  const duration = Date.now() - start;
  const [log] = await db
    .insert(debateLogs)
    .values({
      user_id: input.userId,
      trigger_type: input.triggerType,
      debate_topic: input.topic,
      rounds,
      consensus_reached: critic.verdict !== "REJECTED",
      final_verdict: finalVerdict,
      judge_rationale: judgeRound.position,
      debate_duration_ms: duration,
      agents_involved: rounds.map(r => r.agent),
    })
    .returning({ id: debateLogs.id })
    .catch(err => {
      logger.warn({ err }, "[DebateEngine] Failed to persist debate log");
      return [{ id: undefined as string | undefined }];
    });

  logger.info({ userId: input.userId, debateType: input.debateType, duration }, "[DebateEngine] Complete");

  return {
    consensusReached: critic.verdict !== "REJECTED",
    finalVerdict,
    judgeRationale: judgeRound.position,
    winningPosition: judgeRound.position,
    dissents: rounds.filter(r => r.agent !== "JUDGE").map(r => `${r.agent}: ${r.position}`),
    confidenceTier: critic.confidenceTier,
    debateSummary: `Debate on ${input.topic}: ${judgeRound.position}`,
    debateLogId: log?.id,
  };
}

export async function escalateAgentConflict(params: {
  userId: string;
  triggerType: string;
  agentA: string;
  agentB: string;
  outputA: unknown;
  outputB: unknown;
}): Promise<DebateResult> {
  await db
    .insert(agentConflictLogs)
    .values({
      user_id: params.userId,
      agent_a: params.agentA,
      agent_b: params.agentB,
      trigger_type: params.triggerType,
      agent_a_output: params.outputA as Record<string, unknown>,
      agent_b_output: params.outputB as Record<string, unknown>,
      conflict_type: "CONTRADICTION",
      resolution: "JUDGE_DECIDED",
      resolved_output: params.outputA as Record<string, unknown>,
    })
    .catch(err => {
      logger.warn({ err }, "[DebateEngine] Failed to persist agent conflict log");
    });

  return runDebate({
    topic: `Agent conflict: ${params.agentA} vs ${params.agentB}`,
    userId: params.userId,
    triggerType: params.triggerType,
    contextPacket: { outputA: params.outputA, outputB: params.outputB, stateVersion: 0 },
    debateType: "AGENT_CONFLICT",
    feasibilityScore: 0.3,
  });
}
