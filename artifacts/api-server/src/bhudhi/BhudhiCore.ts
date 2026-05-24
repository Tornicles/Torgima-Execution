import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { BHUDHI_MODEL } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";
import {
  FORBIDDEN_MODES,
  type BhudhiOutputEnvelope,
  type BhudhiTriggerRequest,
  type BhudhiTriggerResult,
} from "../types/bhudhi.js";
import { getContract, PromptRegistry } from "./PromptRegistry.js";
import type { BhudhiMode } from "../types/bhudhi.js";
import { getFallback } from "./FallbackLibrary.js";
import { validateOutput } from "./OutputValidator.js";
import { retrieveMemory } from "./MemoryService.js";
import {
  checkUsageAllowed,
  getMaxTokensForTrigger,
  getTimeout,
  logUsage,
  updateBhudhiLog,
} from "./UsageController.js";
import { reviewOutput } from "./agents/CriticAgent.js";
import { logFallbackUsage } from "./fallbackUsageLog.js";
import {
  checkTriggerAllowed,
  enterAgentChain,
  exitAgentChain,
  breakCircuit,
  incrementSessionOutput,
} from "../engines/stability/StabilityEngine.js";
import { getActiveAgentsForTrigger } from "./AgentRegistry.js";
import { appendWebSearchInstruction } from "./erectorWebSearch.js";
import type { BhudhiProvider } from "./bhudhiProviders.js";
import { providerForTrigger } from "./bhudhiProviders.js";
import { geminiApiKeyConfigured } from "./gemini-client.js";

/** Sole LLM transport — implemented only in TriggerRouter (Bhudhi B1). */
export type BhudhiModelInvoker = (params: {
  provider: BhudhiProvider;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}) => Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  intelligenceGrounded: boolean;
  provider?: BhudhiProvider;
}>;

export type BhudhiPipelineDeps = {
  invokeModel: BhudhiModelInvoker;
};

// ── GOVERNED PIPELINE (TriggerRouter-only entry) ─────────────────────────────

function resolvePromptContract(request: BhudhiTriggerRequest & { requestedMode?: string }) {
  if (request.requestedMode) {
    return (
      PromptRegistry.lookup(request.triggerType, request.requestedMode) ??
      getContract(request.triggerType)
    );
  }
  return getContract(request.triggerType);
}

type PipelineRequest = BhudhiTriggerRequest & { requestedMode?: BhudhiMode };

export async function runBhudhiPipeline<T = unknown>(
  request: PipelineRequest,
  deps: BhudhiPipelineDeps,
): Promise<BhudhiTriggerResult<T>> {

  const startTime = Date.now();
  let logId = "";

  const chainId = `${request.userId}:${request.triggerType}`;
  const chain = enterAgentChain(chainId);
  if (!chain.allowed) {
    await breakCircuit(chainId, "Agent chain depth exceeded");
    exitAgentChain(chainId);
    const contractEarly = getContract(request.triggerType);
    let logId = "";
    if (contractEarly) {
      logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      sourceEngine: request.sourceEngine,
        promptName: contractEarly.name,
        promptVersion: contractEarly.version,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startTime,
        status: "rejected",
        fallbackReason: "agent_chain_depth_exceeded",
      }).catch(() => "");
    }
    return { ok: false, fallbackUsed: true, logId, failureReason: "Circuit breaker" };
  }

  const stabilityCheck = await checkTriggerAllowed(request.triggerType, request.userId);
  if (!stabilityCheck.allowed) {
    exitAgentChain(chainId);
    const contractEarly = getContract(request.triggerType);
    if (contractEarly) {
      logId = await logUsage({
        userId: request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      sourceEngine: request.sourceEngine,
        promptName: contractEarly.name,
        promptVersion: contractEarly.version,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startTime,
        status: "rejected",
        fallbackReason: stabilityCheck.reason,
      }).catch(() => "");
      const fallback = getFallback(contractEarly.fallbackKey, request.facts ?? {}, request.stateVersion);
      await logFallbackUsage({
        triggerType: request.triggerType,
        promptName: contractEarly.name,
        reason: stabilityCheck.reason ?? "STABILITY_THROTTLE",
        userId: request.userId,
        bhudhiLogId: logId || undefined,
      }).catch(() => null);
      return {
        ok: true,
        output: fallback as BhudhiOutputEnvelope<T>,
        fallbackUsed: true,
        logId: logId ?? "",
        failureReason: stabilityCheck.reason,
      };
    }
    return { ok: false, fallbackUsed: true, logId: "", failureReason: stabilityCheck.reason };
  }

  const contract = resolvePromptContract(request);
  if (!contract) {
    exitAgentChain(chainId);
    logger.warn({ triggerType: request.triggerType }, "[BhudhiCore] Unregistered trigger type");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Unregistered trigger type" };
  }

  if (FORBIDDEN_MODES.includes(contract.mode)) {
    exitAgentChain(chainId);
    logger.error({ mode: contract.mode, triggerType: request.triggerType }, "[BhudhiCore] Forbidden mode attempted");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Forbidden Bhudhi mode" };
  }

  const usageCheck = await checkUsageAllowed({ userId: request.userId, triggerType: request.triggerType });
  if (!usageCheck.allowed) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "rejected",
      fallbackReason: usageCheck.reason,
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: usageCheck.reason ?? "BUDGET_EXCEEDED",
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok:            true,
      output:        fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed:  true,
      logId:         logId ?? "",
      failureReason: usageCheck.reason,
    };
  }

  let aiEnabled = true;
  try {
    const [aiFlag] = await db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.feature_name, "ai_enabled"))
      .limit(1);
    aiEnabled = aiFlag?.enabled ?? true;
  } catch {
    aiEnabled = true;
  }

  if (!aiEnabled) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "fallback",
      fallbackReason: "ai_disabled",
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: "ai_disabled",
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId: logId ?? "" };
  }

  let memoryContext = "";
  if (contract.memoryAllowed) {
    try {
      memoryContext = await retrieveMemory({
        userId:      request.userId,
        blueprintId: request.blueprintId,
        triggerType: request.triggerType,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ msg }, "[BhudhiCore] Memory retrieval failed — continuing without memory");
      memoryContext = "";
    }
  }

  const facts: Record<string, unknown> = {
    ...request.facts,
    stateVersion: request.stateVersion,
    userInput:    request.userInput,
    memoryContext,
  };

  const provider: BhudhiProvider = contract.provider ?? providerForTrigger(request.triggerType);

  try {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      sourceEngine:  request.sourceEngine,
      promptName:    contract.name,
      promptVersion: contract.version,
      provider,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     0,
      status:        "pending",
      fallbackReason: undefined,
      errorCode:     undefined,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[BhudhiCore] BhudhiLog write failed — aborting call (fail closed)",
    );
    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId: "" };
  }

  const timeout = getTimeout(request.triggerType);
  let rawOutput: unknown = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let webSearchCalls = 0;
  let intelligenceGrounded = false;

  try {
    const userPrompt = contract.buildUserPrompt(facts);

    if (provider === "claude") {
      const apiKey =
        process.env["ANTHROPIC_API_KEY"]?.trim() ||
        process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim();
      if (!apiKey) {
        throw new Error("BHUDHI_NO_API_KEY");
      }
    } else if (!geminiApiKeyConfigured()) {
      throw new Error("BHUDHI_NO_GEMINI_API_KEY");
    }

    const maxTokens = Math.min(contract.maxTokens, getMaxTokensForTrigger(request.triggerType));
    const systemPrompt =
      provider === "gemini-search"
        ? appendWebSearchInstruction(request.triggerType, contract.systemPrompt)
        : contract.systemPrompt;

    const modelResult = await deps.invokeModel({
      provider,
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature: contract.temperature,
      timeoutMs: timeout,
    });

    if (!modelResult) {
      throw new Error("BHUDHI_MODEL_EMPTY");
    }

    inputTokens = modelResult.inputTokens;
    outputTokens = modelResult.outputTokens;
    webSearchCalls = modelResult.webSearchCalls;
    intelligenceGrounded = modelResult.intelligenceGrounded;

    const cleaned = modelResult.text.replace(/```json|```/g, "").trim();
    rawOutput = JSON.parse(cleaned) as unknown;

    if (contract.outputSchema) {
      const zodParsed = contract.outputSchema.safeParse(rawOutput);
      if (!zodParsed.success) {
        throw new Error(
          `Schema validation failed: ${zodParsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      }
      rawOutput = zodParsed.data;
    }
  } catch (error) {
    const errMsg  = error instanceof Error ? error.message : String(error);
    const latency = Date.now() - startTime;

    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: errMsg === "BHUDHI_TIMEOUT" ? "fallback" : "error",
      fallbackReason: errMsg,
      errorCode: errMsg,
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: errMsg,
      userId: request.userId,
      bhudhiLogId: logId || undefined,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok:            true,
      output:        fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed:  true,
      logId,
      failureReason: errMsg,
    };
  }

  const validation = validateOutput(rawOutput, contract.outputType, request.stateVersion);
  const latency    = Date.now() - startTime;

  if (!validation.ok) {
    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: "fallback",
      fallbackReason: `Validation failed: ${validation.errors.join(", ")}`,
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: `Validation failed: ${validation.errors.join(", ")}`,
      userId: request.userId,
      bhudhiLogId: logId,
    }).catch(() => null);
    exitAgentChain(chainId);
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId };
  }

  const agents = getActiveAgentsForTrigger(request.triggerType);
  const producingAgent = agents[0] ?? request.sourceEngine;

  const critic = await reviewOutput({
    output: rawOutput,
    producingAgent,
    triggerType: request.triggerType,
    promptContract: contract.name,
    userId: request.userId,
    worldStateVersion: request.stateVersion,
    bhudhiLogId: logId,
  });

  if (critic.verdict === "REJECTED") {
    await updateBhudhiLog({
      logId,
      inputTokens,
      outputTokens,
      latencyMs: latency,
      status: "rejected",
      fallbackReason: critic.rejectionReason ?? "Critic rejected",
      outputJson: { governanceViolation: critic.governanceViolation },
    }).catch(() => null);

    const fallback = getFallback(contract.fallbackKey, facts, request.stateVersion);
    await logFallbackUsage({
      triggerType: request.triggerType,
      promptName: contract.name,
      reason: critic.rejectionReason ?? "CRITIC_REJECTED",
      userId: request.userId,
      bhudhiLogId: logId,
    }).catch(() => null);
    exitAgentChain(chainId);
    return {
      ok: true,
      output: fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed: true,
      logId,
      failureReason: critic.rejectionReason,
    };
  }

  await updateBhudhiLog({
    logId,
    inputTokens,
    outputTokens,
    latencyMs: latency,
    status: "success",
    outputJson: {
      confidenceTier: critic.confidenceTier,
      criticFlag: critic.flagReason,
      web_search_calls: webSearchCalls,
      intelligence_grounded: intelligenceGrounded,
    },
  }).catch(() => null);

  incrementSessionOutput(request.userId);
  exitAgentChain(chainId);

  logger.info(
    { triggerType: request.triggerType, userId: request.userId, latency, tokens: inputTokens + outputTokens },
    "[BhudhiCore] Call completed",
  );

  const envelope = rawOutput as BhudhiOutputEnvelope<T>;
  if (envelope && typeof envelope === "object") {
    (envelope as BhudhiOutputEnvelope).confidence = critic.confidenceTier;
  }

  return {
    ok:           true,
    output:       rawOutput as BhudhiOutputEnvelope<T>,
    fallbackUsed: false,
    logId,
  };
}

/** @deprecated Prefer {@link routeBhudhiRequest} from TriggerRouter. Legacy adapter for older routes. */
export class BhudhiCore {
  async call(req: import("../types/bhudhi.js").BhudhiRequest): Promise<import("../types/bhudhi.js").BhudhiResponse> {
    const start = Date.now();
    logger.warn({ trigger: req.trigger }, "[BhudhiCore.call] deprecated — use routeBhudhiRequest()");
    return {
      trigger:      req.trigger,
      output:       {},
      model:        BHUDHI_MODEL,
      tokensUsed:   0,
      latencyMs:    Date.now() - start,
      valid:        false,
      fallbackUsed: true,
    };
  }
}

// Re-export for call sites that log manually
export { mapBhudhiTriggerToDbEnum } from "./bhudhiLogMapping.js";