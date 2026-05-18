import { BhudhiCore, trigger as bhudhiTrigger } from "./BhudhiCore.js";
import { buildContextPacket } from "./ContextBuilder.js";
import { getActiveAgentsForTrigger } from "./AgentRegistry.js";
import { getContract } from "./PromptRegistry.js";
import { checkUsageAllowed } from "./UsageController.js";
import { validateOutputLayers } from "./OutputValidatorLayers.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { checkTriggerAllowed } from "../engines/stability/StabilityEngine.js";
import { shouldTriggerDebate, runDebate } from "./DebateEngine.js";
import type { BhudhiTrigger, BhudhiResponse, BhudhiTriggerType } from "../types/bhudhi.js";

export type Prompt1TriggerType =
  | "USER_GOAL_TRIGGER"
  | "BLUEPRINT_GENERATION"
  | "TASK_DRAFTING"
  | "FEEDBACK_CLASSIFICATION"
  | "STATE_EXPLANATION"
  | "RECOVERY_COPY"
  | "ACADEMY_SUPPORT"
  | "OUTCOME_EVIDENCE_SUMMARY"
  | "ROOT_CAUSE_ASSIST"
  | "DOMAIN_RESOLUTION"
  | "BLUEPRINT_INTERPRETATION"
  | "KNOWLEDGE_INJECTION"
  | "EXECUTION_SUPPORT"
  | "OVERNIGHT_CYCLE"
  | "WORLD_STATE_UPDATE"
  | "COMPRESSION_CYCLE"
  | "SELF_IMPROVEMENT_CYCLE";

export interface TriggerContext {
  userId: string;
  blueprintId?: string;
  orderId?: string;
  feedbackId?: string;
  payload: Record<string, unknown>;
  worldStateVersion: number;
  currentCondition: string;
  triggerType: Prompt1TriggerType | BhudhiTriggerType;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface TriggerResult {
  allowed: boolean;
  denialReason?: string;
  selectedAgents: string[];
  promptContract: string;
  contextPacket: Record<string, unknown>;
  useFallback: boolean;
  bhudhiResponse?: BhudhiResponse;
}

const TRIGGER_TO_CANONICAL: Partial<Record<Prompt1TriggerType, BhudhiTriggerType>> = {
  USER_GOAL_TRIGGER: "GOAL_STRUCTURING",
  TASK_DRAFTING: "TASK_DRAFTING",
  FEEDBACK_CLASSIFICATION: "FEEDBACK_CLASSIFICATION",
  STATE_EXPLANATION: "STATE_EXPLANATION",
  RECOVERY_COPY: "RECOVERY_COPY",
  ACADEMY_SUPPORT: "ACADEMY_SUPPORT",
  OUTCOME_EVIDENCE_SUMMARY: "OUTCOME_EVIDENCE_SUMMARY",
  ROOT_CAUSE_ASSIST: "ROOT_CAUSE_ASSIST",
  BLUEPRINT_INTERPRETATION: "BLUEPRINT_INTERPRETATION",
  BLUEPRINT_GENERATION: "BLUEPRINT_GENERATION",
  DOMAIN_RESOLUTION: "DOMAIN_RESOLUTION",
  EXECUTION_SUPPORT: "EXECUTION_SUPPORT",
};

function mapToCanonical(triggerType: string): BhudhiTriggerType | null {
  if (TRIGGER_TO_CANONICAL[triggerType as Prompt1TriggerType]) {
    return TRIGGER_TO_CANONICAL[triggerType as Prompt1TriggerType] ?? null;
  }
  const contract = getContract(triggerType as BhudhiTriggerType);
  return contract ? (triggerType as BhudhiTriggerType) : null;
}

export async function routeTrigger(ctx: TriggerContext): Promise<TriggerResult> {
  const canonical = mapToCanonical(ctx.triggerType);
  if (!canonical) {
    return {
      allowed: false,
      denialReason: `Unregistered trigger: ${ctx.triggerType}`,
      selectedAgents: [],
      promptContract: "",
      contextPacket: {},
      useFallback: true,
    };
  }

  const contract = getContract(canonical);

  if (!contract) {
    return {
      allowed: false,
      denialReason: `Unregistered trigger: ${ctx.triggerType}`,
      selectedAgents: [],
      promptContract: "",
      contextPacket: {},
      useFallback: true,
    };
  }

  const stability = await checkTriggerAllowed(canonical, ctx.userId);
  if (!stability.allowed) {
    return {
      allowed: false,
      denialReason: stability.reason,
      selectedAgents: [],
      promptContract: contract.name,
      contextPacket: {},
      useFallback: true,
    };
  }

  const feasibilityScore = Number(ctx.payload["feasibilityScore"] ?? 1);
  if (
    shouldTriggerDebate({
      triggerType: ctx.triggerType,
      feasibilityScore,
      hardContradictionCount: Number(ctx.payload["hardContradictionCount"] ?? 0),
    })
  ) {
    await runDebate({
      topic: String(ctx.payload["goal"] ?? ctx.triggerType),
      userId: ctx.userId,
      triggerType: ctx.triggerType,
      contextPacket: ctx.payload as Record<string, unknown>,
      debateType: feasibilityScore < 0.35 ? "HIGH_RISK_VALIDATION" : "DIRECTION_ANALYSIS",
      feasibilityScore,
    }).catch(() => null);
  }

  const usage = await checkUsageAllowed({ userId: ctx.userId, triggerType: canonical as BhudhiTriggerType });
  if (!usage.allowed) {
    return {
      allowed: false,
      denialReason: usage.reason,
      selectedAgents: [],
      promptContract: contract.name,
      contextPacket: {},
      useFallback: true,
    };
  }

  const agents = getActiveAgentsForTrigger(ctx.triggerType);
  const contextPacket = await buildContextPacket({
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
    triggerType: canonical,
    payload: ctx.payload,
    worldStateVersion: ctx.worldStateVersion,
    currentCondition: ctx.currentCondition,
    userInput: typeof ctx.payload["userInput"] === "string" ? ctx.payload["userInput"] : undefined,
  });

  const world = await getWorldModel(ctx.userId);
  const stateVersion = world?.stateVersion ?? ctx.worldStateVersion;

  const result = await bhudhiTrigger({
    sourceEngine: "TriggerRouter",
    triggerType: canonical,
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
    stateVersion,
    userInput: typeof ctx.payload["userInput"] === "string" ? ctx.payload["userInput"] : undefined,
    facts: { ...ctx.payload, currentCondition: ctx.currentCondition },
    idempotencyKey: `${ctx.triggerType}:${ctx.userId}:${Date.now()}`,
  });

  if (result.output) {
    const validation = await validateOutputLayers({
      raw: result.output,
      expectedType: contract.outputType,
      expectedStateVersion: stateVersion,
      userId: ctx.userId,
      promptContract: contract.name,
    });
    if (!validation.passed) {
      return {
        allowed: false,
        denialReason: validation.failReason,
        selectedAgents: agents,
        promptContract: contract.name,
        contextPacket: contextPacket as unknown as Record<string, unknown>,
        useFallback: true,
      };
    }
  }

  return {
    allowed: true,
    selectedAgents: agents,
    promptContract: contract.name,
    contextPacket: contextPacket as unknown as Record<string, unknown>,
    useFallback: result.fallbackUsed,
    bhudhiResponse: result.output
      ? {
          trigger: canonical as unknown as BhudhiTrigger,
          output: result.output as unknown as Record<string, unknown>,
          model: process.env.BHUDHI_MODEL ?? "claude-sonnet-4-20250514",
          tokensUsed: 0,
          latencyMs: 0,
          valid: true,
          fallbackUsed: result.fallbackUsed,
        }
      : undefined,
  };
}

/** Legacy wrapper — prefer {@link routeTrigger}. */
export class TriggerRouter {
  private core = new BhudhiCore();

  async route(
    triggerName: BhudhiTrigger,
    userId: string,
    context: Record<string, unknown>,
  ): Promise<BhudhiResponse> {
    return this.core.call({ trigger: triggerName, userId, context });
  }
}
