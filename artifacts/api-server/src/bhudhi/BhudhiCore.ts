import { db, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createBhudhiMessage, BHUDHI_MODEL } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";
import {
  FORBIDDEN_MODES,
  type BhudhiOutputEnvelope,
  type BhudhiTriggerRequest,
  type BhudhiTriggerResult,
} from "../types/bhudhi.js";
import { getContract } from "./PromptRegistry.js";
import { getFallback } from "./FallbackLibrary.js";
import { validateOutput } from "./OutputValidator.js";
import { retrieveMemory } from "./MemoryService.js";
import { checkUsageAllowed, getTimeout, logUsage, updateBhudhiLog } from "./UsageController.js";

function extractTextBlocks(response: { content: Array<{ type: string; text?: string }> }): string {
  return response.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    .map(b => b.text)
    .join("");
}

// ── TRIGGER ROUTER ────────────────────────────────────────────────────────────

export async function trigger<T = unknown>(
  request: BhudhiTriggerRequest,
): Promise<BhudhiTriggerResult<T>> {

  const startTime = Date.now();
  let logId = "";

  const contract = getContract(request.triggerType);
  if (!contract) {
    logger.warn({ triggerType: request.triggerType }, "[BhudhiCore] Unregistered trigger type");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Unregistered trigger type" };
  }

  if (FORBIDDEN_MODES.includes(contract.mode)) {
    logger.error({ mode: contract.mode, triggerType: request.triggerType }, "[BhudhiCore] Forbidden mode attempted");
    return { ok: false, fallbackUsed: true, logId: "", failureReason: "Forbidden Bhudhi mode" };
  }

  const usageCheck = await checkUsageAllowed({ userId: request.userId, triggerType: request.triggerType });
  if (!usageCheck.allowed) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "rejected",
      fallbackReason: usageCheck.reason,
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
    return {
      ok:            true,
      output:        fallback as BhudhiOutputEnvelope<T>,
      fallbackUsed:  true,
      logId:         logId ?? "",
      failureReason: usageCheck.reason,
    };
  }

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);

  if (!aiFlag?.enabled) {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      promptName:    contract.name,
      promptVersion: contract.version,
      inputTokens:   0,
      outputTokens:  0,
      latencyMs:     Date.now() - startTime,
      status:        "fallback",
      fallbackReason: "ai_disabled",
    }).catch(() => "");

    const fallback = getFallback(contract.fallbackKey, request.facts ?? {}, request.stateVersion);
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
      logger.error({ msg }, "[BhudhiCore] Memory retrieval hard failure");
      return { ok: false, fallbackUsed: false, logId: "", failureReason: msg };
    }
  }

  const facts: Record<string, unknown> = {
    ...request.facts,
    stateVersion: request.stateVersion,
    userInput:    request.userInput,
    memoryContext,
  };

  try {
    logId = await logUsage({
      userId:        request.userId,
      blueprintId:   request.blueprintId,
      triggerType:   request.triggerType,
      promptName:    contract.name,
      promptVersion: contract.version,
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

  try {
    const userPrompt  = contract.buildUserPrompt(facts);
    const apiKey =
      process.env["ANTHROPIC_API_KEY"]?.trim() ||
      process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim();
    if (!apiKey) {
      throw new Error("BHUDHI_NO_API_KEY");
    }

    const response = await Promise.race([
      createBhudhiMessage({
        model:       BHUDHI_MODEL,
        max_tokens:  contract.maxTokens,
        temperature: contract.temperature,
        system:      contract.systemPrompt,
        messages:    [{ role: "user", content: userPrompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), timeout)),
    ]);

    const text = extractTextBlocks(response);
    inputTokens  = response.usage?.input_tokens  ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;

    const cleaned = text.replace(/```json|```/g, "").trim();
    rawOutput = JSON.parse(cleaned) as unknown;
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
    return { ok: true, output: fallback as BhudhiOutputEnvelope<T>, fallbackUsed: true, logId };
  }

  await updateBhudhiLog({
    logId,
    inputTokens,
    outputTokens,
    latencyMs: latency,
    status: "success",
  }).catch(() => null);

  logger.info(
    { triggerType: request.triggerType, userId: request.userId, latency, tokens: inputTokens + outputTokens },
    "[BhudhiCore] Call completed",
  );

  return {
    ok:           true,
    output:       rawOutput as BhudhiOutputEnvelope<T>,
    fallbackUsed: false,
    logId,
  };
}

export async function explainState(params: {
  userId:               string;
  blueprintId?:        string;
  stateVersion:         number;
  condition:            string;
  completionRate:       number;
  weightedScore:        number;
  momentum:             number;
  trend:                string;
  goal:                 string;
  currentTaskTitle?:    string;
  conditionDuration?:   number;
  /** Grounding slice of persisted operational math — interpretation only. */
  operationalMathematicsExcerpt?: Record<string, unknown> | null;
}): Promise<BhudhiTriggerResult> {
  return trigger({
    sourceEngine:   "dashboard",
    triggerType:    "STATE_EXPLANATION",
    userId:         params.userId,
    blueprintId:    params.blueprintId,
    stateVersion:   params.stateVersion,
    idempotencyKey: `explain:${params.blueprintId ?? params.userId}:${Date.now()}`,
    facts: {
      condition:         params.condition,
      conditionDuration: params.conditionDuration ?? 0,
      completionRate:    params.completionRate,
      weightedScore:     params.weightedScore,
      momentum:          params.momentum,
      trend:             params.trend,
      goal:              params.goal,
      currentTaskTitle:  params.currentTaskTitle,
      governance:
        "Bhudhi interprets ONLY from facts below; MUST NOT change condition, locks, dependencies, or invent signal values.",
      operationalMathExcerpt:
        params.operationalMathematicsExcerpt ??
        ({
          absent: true,
          note:   "No operational mathematics payload on signal snapshot — stay qualitative.",
        } as Record<string, unknown>),
    },
  });
}

/** @deprecated Prefer {@link trigger}. Legacy adapter for older routes. */
export class BhudhiCore {
  async call(req: import("../types/bhudhi.js").BhudhiRequest): Promise<import("../types/bhudhi.js").BhudhiResponse> {
    const start = Date.now();
    logger.warn({ trigger: req.trigger }, "[BhudhiCore.call] deprecated — use trigger()");
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