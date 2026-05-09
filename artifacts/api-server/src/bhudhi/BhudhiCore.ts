import { db, bhudhiLogs, featureFlags } from "@workspace/db";
import { eq } from "drizzle-orm";
import { anthropic, BHUDHI_MODEL } from "../lib/anthropic.js";
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
import { VALIDATION_PATHS_LOG_TRIGGER } from "./bhudhiLogMapping.js";
import type { ValidationPath, ValidationScores, ValidationVerdict } from "../types/validation.js";

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
    const apiKey      = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("BHUDHI_NO_API_KEY");
    }

    const response = await Promise.race([
      anthropic.messages.create({
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
  blueprintId?:         string;
  stateVersion:         number;
  condition:            string;
  completionRate:       number;
  weightedScore:        number;
  momentum:             number;
  trend:                string;
  goal:                 string;
  currentTaskTitle?:    string;
  conditionDuration?:   number;
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
    },
  });
}

/**
 * Validation execution paths (three-path JSON) — Anthropic lives here only, not in ValidationEngine.
 */
export async function generateValidationPathsWithBhudhi(params: {
  userId:          string;
  blueprintId:     string;
  goal:             string;
  purpose?:         string;
  timeframe?:       string;
  commitmentLevel?: string;
  scores:           ValidationScores;
  verdict:          ValidationVerdict;
}): Promise<{ current: ValidationPath; adjusted: ValidationPath; alternative: ValidationPath }> {
  const start = Date.now();

  const usageCheck = await checkUsageAllowed({ userId: params.userId, triggerType: "validation_paths" });
  if (!usageCheck.allowed) {
    throw new Error(usageCheck.reason ?? "usage_cap");
  }

  const [aiFlag] = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.feature_name, "ai_enabled"))
    .limit(1);

  if (!aiFlag?.enabled || !process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error("ai_disabled");
  }

  const [logRow] = await db
    .insert(bhudhiLogs)
    .values({
      user_id:      params.userId,
      blueprint_id: params.blueprintId,
      request_type: "other",
      trigger_type: VALIDATION_PATHS_LOG_TRIGGER,
      input_json:   { blueprintId: params.blueprintId, kind: "validation_paths_v1" },
      prompt_version: "validation.paths.v1",
      model_used: BHUDHI_MODEL,
      token_count_in: 0,
      token_count_out: 0,
      latency_ms: 0,
      validation_status: "pending",
    })
    .returning({ id: bhudhiLogs.id });

  if (!logRow) {
    throw new Error("BhudhiLog intent failed");
  }

  const logId = logRow.id;

  const systemPrompt = `You are the Torgima Validation Engine. Your ONLY job is to output a JSON object with three execution path options based on the user's goal.

RULES:
- Return ONLY valid JSON. No markdown, no explanation, no preamble.
- Each path must be realistic and actionable.
- Do not invent facts about the user.
- Keep rationale to 1–2 sentences maximum.
- planSkeleton.plans must have 2–3 items. planSkeleton.targets must have 2–3 items.
- riskLevel must be "low", "medium", or "high".
- Never suggest the user abandon their goal entirely.`;

  const userPrompt = `Goal: "${params.goal}"
Purpose: "${params.purpose ?? "not provided"}"
Timeframe: "${params.timeframe ?? "not provided"}"
Commitment: "${params.commitmentLevel ?? "not provided"}"
Clarity score: ${params.scores.clarity.score}/100 — ${params.scores.clarity.finding}
Feasibility score: ${params.scores.feasibility.score}/100 — ${params.scores.feasibility.finding}
Verdict: ${params.verdict}

Generate three execution paths. Return this EXACT JSON structure and nothing else:
{
  "current": {
    "type": "current",
    "title": "...",
    "summary": "...",
    "rationale": "...",
    "expectedOutcome": "...",
    "riskLevel": "low|medium|high",
    "planSkeleton": {
      "plans": [{"name": "...", "description": "..."}],
      "targets": [{"name": "...", "type": "major|primary|vital"}]
    }
  },
  "adjusted": {
    "type": "adjusted",
    "title": "...",
    "summary": "...",
    "rationale": "...",
    "expectedOutcome": "...",
    "riskLevel": "low|medium|high",
    "keyChanges": "...",
    "planSkeleton": {
      "plans": [{"name": "...", "description": "..."}],
      "targets": [{"name": "...", "type": "major|primary|vital"}]
    }
  },
  "alternative": {
    "type": "alternative",
    "title": "...",
    "summary": "...",
    "rationale": "...",
    "expectedOutcome": "...",
    "riskLevel": "low|medium|high",
    "keyChanges": "...",
    "planSkeleton": {
      "plans": [{"name": "...", "description": "..."}],
      "targets": [{"name": "...", "type": "major|primary|vital"}]
    }
  }
}`;

  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model:       BHUDHI_MODEL,
        max_tokens:  1200,
        temperature: 0.2,
        system:      systemPrompt,
        messages:    [{ role: "user", content: userPrompt }],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), getTimeout("GOAL_STRUCTURING"))),
    ]);

    const rawText = extractTextBlocks(response);
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed  = JSON.parse(cleaned) as {
      current: ValidationPath;
      adjusted: ValidationPath;
      alternative: ValidationPath;
    };

    if (!parsed.current || !parsed.adjusted || !parsed.alternative) {
      throw new Error("Bhudhi returned incomplete path structure");
    }

    parsed.current.type      = "current";
    parsed.adjusted.type     = "adjusted";
    parsed.alternative.type  = "alternative";

    const latency = Date.now() - start;
    await updateBhudhiLog({
      logId,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      latencyMs: latency,
      status: "success",
    }).catch(() => null);

    return parsed;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await updateBhudhiLog({
      logId,
      latencyMs: Date.now() - start,
      status: "error",
      errorCode: errMsg,
      fallbackReason: errMsg,
    }).catch(() => null);
    throw err;
  }
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