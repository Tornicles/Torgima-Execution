import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/index.mjs";
import { BhudhiCore } from "./BhudhiCore.js";
import { runBhudhiPipeline } from "./BhudhiCore.js";
import { buildContextPacket } from "./ContextBuilder.js";
import { getActiveAgentsForTrigger } from "./AgentRegistry.js";
import { getContract } from "./PromptRegistry.js";
import { getFallback } from "./FallbackLibrary.js";
import { checkUsageAllowed, logUsage } from "./UsageController.js";
import { validateOutputLayers } from "./OutputValidatorLayers.js";
import { getWorldModel } from "../engines/world-model/WorldModelEngine.js";
import { checkTriggerAllowed } from "../engines/stability/StabilityEngine.js";
import { shouldTriggerDebate, runDebate } from "./DebateEngine.js";
import { BHUDHI_MODEL } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";
import { callGeminiRaw } from "./gemini-client.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";
import {
  FORBIDDEN_MODES,
  type BhudhiMode,
  type BhudhiTrigger,
  type BhudhiResponse,
  type BhudhiTriggerRequest,
  type BhudhiTriggerResult,
  type BhudhiTriggerType,
  type BhudhiOutputEnvelope,
} from "../types/bhudhi.js";

// ── Anthropic SDK — sole allowed site (Bhudhi B1) ─────────────────────────────

const globalForAnthropic = globalThis as unknown as { bhudhiAnthropic: Anthropic | undefined };

function getAnthropicClient(): Anthropic {
  if (globalForAnthropic.bhudhiAnthropic) return globalForAnthropic.bhudhiAnthropic;

  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey =
    process.env["ANTHROPIC_API_KEY"]?.trim() ||
    process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim();

  if (!apiKey) {
    logger.warn(
      "ANTHROPIC_API_KEY (or legacy AI_INTEGRATIONS_ANTHROPIC_API_KEY) not set — Bhudhi will use fallbacks",
    );
  }

  const client = new Anthropic({
    apiKey: apiKey ?? "placeholder",
    ...(baseURL ? { baseURL } : {}),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForAnthropic.bhudhiAnthropic = client;
  }

  return client;
}

function extractTextBlocks(response: { content: Array<{ type: string; text?: string }> }): string {
  return response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

/** Only TriggerRouter invokes the Anthropic Messages API (Claude execution calls). */
export async function invokeAnthropicModel(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  intelligenceGrounded: boolean;
}> {
  const client = getAnthropicClient();
  const body: MessageCreateParamsNonStreaming = {
    model: BHUDHI_MODEL,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userPrompt }],
  };

  const response = await Promise.race([
    client.messages.create(body),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), params.timeoutMs),
    ),
  ]);

  const text = extractTextBlocks(response).trim();

  return {
    text,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    webSearchCalls: 0,
    intelligenceGrounded: false,
  };
}

export type BhudhiModelInvokeParams = {
  provider: BhudhiProvider;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
};

/** Routes Bhudhi calls to Claude (execution) or Gemini (validation / search). */
export async function invokeBhudhiModel(params: BhudhiModelInvokeParams): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  intelligenceGrounded: boolean;
  provider: BhudhiProvider;
}> {
  if (params.provider === "gemini" || params.provider === "gemini-search") {
    const invokeOnce = () =>
      Promise.race([
        callGeminiRaw({
          prompt: params.userPrompt,
          systemPrompt: params.systemPrompt,
          useSearch: params.provider === "gemini-search",
          maxTokens: params.provider === "gemini-search" ? 2500 : params.maxTokens,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), params.timeoutMs),
        ),
      ]);

    let text: string;
    try {
      text = await invokeOnce();
    } catch (firstErr) {
      if (firstErr instanceof Error && firstErr.message === "BHUDHI_TIMEOUT") {
        text = await Promise.race([
          callGeminiRaw({
            prompt: params.userPrompt,
            systemPrompt: params.systemPrompt,
            useSearch: params.provider === "gemini-search",
            maxTokens: params.provider === "gemini-search" ? 2500 : params.maxTokens,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), 5_000)),
        ]);
      } else {
        throw firstErr;
      }
    }

    if (!text) throw new Error(params.provider === "gemini-search" ? "BHUDHI_GEMINI_SEARCH_EMPTY" : "BHUDHI_GEMINI_EMPTY");
    return {
      text,
      inputTokens: 0,
      outputTokens: 0,
      webSearchCalls: params.provider === "gemini-search" ? 1 : 0,
      intelligenceGrounded: params.provider === "gemini-search",
      provider: params.provider,
    };
  }

  const claude = await invokeAnthropicModel(params);
  return { ...claude, provider: "claude" };
}

// ── Governed entry points ─────────────────────────────────────────────────────

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
  logId?: string;
}

export type BhudhiRouteRequest = BhudhiTriggerRequest & {
  requestedMode?: BhudhiMode;
  currentCondition?: string;
};

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

function rejectBannedMode(
  requestedMode: BhudhiMode | undefined,
  contractMode: BhudhiMode,
): string | null {
  if (requestedMode && FORBIDDEN_MODES.includes(requestedMode)) {
    return `Mode ${requestedMode} is banned in Phase 1`;
  }
  if (FORBIDDEN_MODES.includes(contractMode)) {
    return `Mode ${contractMode} is banned in Phase 1`;
  }
  return null;
}

/**
 * Canonical governed Bhudhi entry — all engines and routes must use this (not BhudhiCore directly).
 */
export async function routeBhudhiRequest<T = unknown>(
  request: BhudhiRouteRequest,
): Promise<BhudhiTriggerResult<T>> {
  const contract = getContract(request.triggerType);
  if (!contract) {
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Unregistered trigger type" };
  }

  const modeReject = rejectBannedMode(request.requestedMode, contract.mode);
  if (modeReject) {
    return { ok: false, fallbackUsed: true, logId: "", failureReason: modeReject };
  }

  let currentWorldVersion = 0;
  try {
    const world = await getWorldModel(request.userId);
    currentWorldVersion = world?.stateVersion ?? 0;
  } catch {
    currentWorldVersion = request.stateVersion;
  }

  if (request.stateVersion > 0 && request.stateVersion < currentWorldVersion) {
    const fallback = getFallback(
      contract.fallbackKey,
      request.facts ?? {},
      currentWorldVersion,
    ) as BhudhiOutputEnvelope<T>;
    const logId = await logUsage({
      userId: request.userId,
      blueprintId: request.blueprintId,
      triggerType: request.triggerType,
      sourceEngine: request.sourceEngine,
      promptName: contract.name,
      promptVersion: contract.version,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      status: "rejected",
      fallbackReason: "stale_state_version",
    }).catch(() => "");
    return {
      ok: true,
      output: fallback,
      fallbackUsed: true,
      logId: logId ?? "",
      failureReason: "stale_state_version",
    };
  }

  const stateVersion =
    request.stateVersion > 0 ? request.stateVersion : currentWorldVersion;

  return runBhudhiPipeline<T>(
    { ...request, stateVersion },
    { invokeModel: invokeBhudhiModel },
  );
}

export async function explainState(params: {
  userId: string;
  blueprintId?: string;
  stateVersion: number;
  condition: string;
  completionRate: number;
  weightedScore: number;
  momentum: number;
  trend: string;
  goal: string;
  currentTaskTitle?: string;
  conditionDuration?: number;
  operationalMathematicsExcerpt?: Record<string, unknown> | null;
}): Promise<BhudhiTriggerResult> {
  return routeBhudhiRequest({
    sourceEngine: "DASHBOARD",
    triggerType: "STATE_EXPLANATION",
    userId: params.userId,
    blueprintId: params.blueprintId,
    stateVersion: params.stateVersion,
    requestedMode: "EXPLAIN",
    idempotencyKey: `explain:${params.blueprintId ?? params.userId}:${Date.now()}`,
    facts: {
      condition: params.condition,
      conditionDuration: params.conditionDuration ?? 0,
      completionRate: params.completionRate,
      weightedScore: params.weightedScore,
      momentum: params.momentum,
      trend: params.trend,
      goal: params.goal,
      currentTaskTitle: params.currentTaskTitle,
      governance:
        "Bhudhi interprets ONLY from facts below; MUST NOT change condition, locks, dependencies, or invent signal values.",
      operationalMathExcerpt:
        params.operationalMathematicsExcerpt ??
        ({
          absent: true,
          note: "No operational mathematics payload on signal snapshot — stay qualitative.",
        } as Record<string, unknown>),
    },
  });
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

  const modeReject = rejectBannedMode(undefined, contract.mode);
  if (modeReject) {
    return {
      allowed: false,
      denialReason: modeReject,
      selectedAgents: [],
      promptContract: contract.name,
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

  const usage = await checkUsageAllowed({ userId: ctx.userId, triggerType: canonical });
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

  if (ctx.worldStateVersion > 0 && ctx.worldStateVersion < stateVersion) {
    return {
      allowed: false,
      denialReason: "stale_state_version",
      selectedAgents: agents,
      promptContract: contract.name,
      contextPacket: contextPacket as unknown as Record<string, unknown>,
      useFallback: true,
    };
  }

  const result = await runBhudhiPipeline({
    sourceEngine: "TriggerRouter",
    triggerType: canonical,
    userId: ctx.userId,
    blueprintId: ctx.blueprintId,
    stateVersion,
    userInput: typeof ctx.payload["userInput"] === "string" ? ctx.payload["userInput"] : undefined,
    facts: { ...ctx.payload, currentCondition: ctx.currentCondition },
    idempotencyKey: `${ctx.triggerType}:${ctx.userId}:${Date.now()}`,
  }, { invokeModel: invokeBhudhiModel });

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
        logId: result.logId,
      };
    }
  }

  return {
    allowed: true,
    selectedAgents: agents,
    promptContract: contract.name,
    contextPacket: contextPacket as unknown as Record<string, unknown>,
    useFallback: result.fallbackUsed,
    logId: result.logId,
    bhudhiResponse: result.output
      ? {
          trigger: canonical as unknown as BhudhiTrigger,
          output: result.output as unknown as Record<string, unknown>,
          model: BHUDHI_MODEL,
          tokensUsed: 0,
          latencyMs: 0,
          valid: true,
          fallbackUsed: result.fallbackUsed,
        }
      : undefined,
  };
}

/** B1 spec alias — prefer {@link routeBhudhiRequest} or {@link routeTrigger}. */
export class TriggerRouter {
  private core = new BhudhiCore();

  async route<T>(request: BhudhiRouteRequest): Promise<BhudhiTriggerResult<T>> {
    return routeBhudhiRequest<T>(request);
  }

  /** @deprecated Legacy shape — use route() with BhudhiTriggerRequest. */
  async routeLegacy(
    triggerName: BhudhiTrigger,
    userId: string,
    context: Record<string, unknown>,
  ): Promise<BhudhiResponse> {
    return this.core.call({ trigger: triggerName, userId, context });
  }
}
