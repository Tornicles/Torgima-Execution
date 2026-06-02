/**
 * DOC3 / DOC4 STEP 2 — register prompt contracts for triggers not yet in PromptRegistry.
 */
import type { BhudhiTriggerType } from "../types/bhudhi.js";
import { getContract, type PromptContract } from "./PromptRegistry.js";
import { getDoc3TriggerRegistry } from "./doc3TriggerRegistry.js";

type PromptRegistryApi = {
  register(contract: PromptContract): void;
};

let promptRegistryApi: PromptRegistryApi | null = null;

const HEADER = `You are Bhudhi inside Torgima — a controlled execution intelligence system.
You are NOT a chatbot. You are NOT the system authority.
Return ONLY the required JSON format. No markdown.`;

function registerDoc3Contract(
  triggerType: BhudhiTriggerType,
  partial: Omit<PromptContract, "triggerType" | "systemPrompt" | "memoryAllowed"> & {
    systemPrompt?: string;
    memoryAllowed?: boolean;
    buildUserPrompt: PromptContract["buildUserPrompt"];
  },
): void {
  const api = promptRegistryApi;
  if (!api?.register) {
    throw new Error(
      "[registerDoc3Prompts] PromptRegistry not initialized — call ensureDoc3PromptsRegistered after export",
    );
  }
  const meta = getDoc3TriggerRegistry().get(triggerType);
  api.register({
    ...partial,
    triggerType,
    systemPrompt: partial.systemPrompt ?? HEADER,
    memoryAllowed: partial.memoryAllowed ?? meta?.memoryPolicy === "allowed",
    timeoutMs: partial.timeoutMs ?? meta?.timeoutMs,
    webSearchEligible: partial.webSearchEligible ?? meta?.webSearchEligible ?? false,
    sourceEngines: partial.sourceEngines ?? meta?.sourceEngines,
  });
}

let registered = false;

export function ensureDoc3PromptsRegistered(api: PromptRegistryApi): void {
  if (!api?.register) {
    throw new Error("[registerDoc3Prompts] registry is undefined — check initialization order");
  }
  if (registered) return;
  promptRegistryApi = api;
  registered = true;

  registerDoc3Contract("POLICY_GENERATION", {
    name: "policy.generate.v1",
    version: "1.0",
    mode: "STRUCTURE",
    outputType: "blueprint_health",
    maxTokens: 500,
    temperature: 0.2,
    fallbackKey: "fallback.policy_generation",
    buildUserPrompt: (ctx) =>
      `Goal: "${String(ctx["goal"] ?? "")}"\nReturn JSON with outputType blueprint_health and data.executionRules: string[3]. stateVersion: ${ctx["stateVersion"] ?? 0}`,
  });

  const taskDraft = getContract("TASK_DRAFTING");
  if (taskDraft) {
    api.register({
      ...taskDraft,
      triggerType: "TASK_REGENERATION",
      name: "task.regenerate.v1",
      buildUserPrompt: (ctx) =>
        `${taskDraft.buildUserPrompt({ ...ctx, difficulty: ctx["adjustedDifficulty"] ?? ctx["difficulty"] })}\nRegenerate with adjusted difficulty label.`,
    });
  }

  registerDoc3Contract("TASK_EXPLANATION", {
    name: "task.explain.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "execution_help",
    maxTokens: 350,
    temperature: 0.2,
    fallbackKey: "fallback.task_explanation",
    buildUserPrompt: (ctx) =>
      `Task: "${String(ctx["taskTitle"] ?? "")}"\nInstruction: "${String(ctx["instruction"] ?? "")}"\nReturn JSON outputType execution_help with data.steps: string[3]. stateVersion: ${ctx["stateVersion"] ?? 0}`,
  });

  registerDoc3Contract("FEEDBACK_INTERROGATION", {
    name: "feedback.interrogate.v1",
    version: "1.0",
    mode: "DRAFT",
    outputType: "clarification_request",
    maxTokens: 300,
    temperature: 0.15,
    fallbackKey: "fallback.clarification",
    buildUserPrompt: (ctx) =>
      `Weak feedback detected. Ask one precise follow-up. Context: ${JSON.stringify(ctx)}. Return clarification_request JSON.`,
  });

  registerDoc3Contract("WEAK_FEEDBACK_DETECTED", {
    name: "feedback.weak.v1",
    version: "1.0",
    mode: "INTERPRET",
    outputType: "blocker_classification",
    maxTokens: 350,
    temperature: 0.15,
    fallbackKey: "fallback.blocker_classification",
    buildUserPrompt: (ctx) =>
      `Classify weak/vague feedback. Return blocker_classification JSON. Feedback: "${String(ctx["feedbackText"] ?? "")}"`,
  });

  registerDoc3Contract("CONDITION_EXPLANATION", {
    name: "condition.explain.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "state_explanation",
    maxTokens: 400,
    temperature: 0.2,
    fallbackKey: "fallback.state_explanation",
    buildUserPrompt: (ctx) =>
      `Condition: ${String(ctx["condition"] ?? "")}\nExplain in plain language. Return state_explanation JSON. stateVersion: ${ctx["stateVersion"] ?? 0}`,
  });

  registerDoc3Contract("STATE_SUMMARY", {
    name: "state.summary.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "state_explanation",
    maxTokens: 350,
    temperature: 0.2,
    fallbackKey: "fallback.state_explanation",
    buildUserPrompt: (ctx) =>
      `Summarize blueprint execution state from facts: ${JSON.stringify(ctx)}. Return state_explanation JSON.`,
  });

  registerDoc3Contract("SIGNAL_INTERPRETATION", {
    name: "signal.interpret.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "signal_narrative",
    maxTokens: 400,
    temperature: 0.2,
    fallbackKey: "fallback.signal_narrative",
    buildUserPrompt: (ctx) =>
      `Metrics: ${JSON.stringify(ctx["metrics"] ?? ctx)}\nReturn signal_narrative JSON with numeric facts only.`,
  });

  registerDoc3Contract("RECOVERY_SUGGESTION", {
    name: "recovery.suggest.v1",
    version: "1.0",
    mode: "SUGGEST",
    outputType: "recovery_copy",
    maxTokens: 400,
    temperature: 0.25,
    fallbackKey: "fallback.recovery_copy",
    buildUserPrompt: (ctx) =>
      `Suggest one small restart action. Goal: "${String(ctx["goal"] ?? "")}". Return recovery_copy JSON.`,
  });

  registerDoc3Contract("BLOCKER_CLASSIFICATION", {
    name: "blocker.classify.v1",
    version: "1.0",
    mode: "INTERPRET",
    outputType: "blocker_classification",
    maxTokens: 350,
    temperature: 0.15,
    fallbackKey: "fallback.blocker_classification",
    buildUserPrompt: (ctx) =>
      `Classify blocker. needs_review=true if uncertain. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("INACTIVITY_MESSAGE", {
    name: "inactivity.message.v1",
    version: "1.0",
    mode: "DRAFT",
    outputType: "restart_copy",
    maxTokens: 300,
    temperature: 0.25,
    fallbackKey: "fallback.restart_copy",
    buildUserPrompt: (ctx) =>
      `Days inactive: ${ctx["daysInactive"] ?? 0}. Calm restart message. Return restart_copy JSON.`,
  });

  registerDoc3Contract("EVIDENCE_SUMMARY", {
    name: "outcome.evidence.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "evidence_summary",
    maxTokens: 450,
    temperature: 0.2,
    fallbackKey: "fallback.evidence_summary",
    buildUserPrompt: (ctx) =>
      `Summarize outcome evidence. Return evidence_summary JSON. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("FALSE_PROGRESS_REVIEW", {
    name: "false_progress.review.v1",
    version: "1.0",
    mode: "INTERPRET",
    outputType: "behavioral_insight",
    maxTokens: 400,
    temperature: 0.2,
    fallbackKey: "fallback.false_progress",
    buildUserPrompt: (ctx) =>
      `Review for false progress. Return behavioral_insight JSON confidence LOW if uncertain. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("OUTCOME_INTERPRETATION", {
    name: "outcome.interpret.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "evidence_summary",
    maxTokens: 400,
    temperature: 0.2,
    fallbackKey: "fallback.evidence_summary",
    buildUserPrompt: (ctx) =>
      `Interpret outcome metrics without overstating. Return evidence_summary JSON. Metrics: ${JSON.stringify(ctx)}`,
  });

  const behavioral = getContract("BEHAVIORAL_ANALYSIS");
  if (behavioral) {
    api.register({ ...behavioral, triggerType: "BEHAVIOR_ANALYSIS", name: "behavior.analyze.v1" });
  } else {
    registerDoc3Contract("BEHAVIOR_ANALYSIS", {
      name: "behavior.analyze.v1",
      version: "1.0",
      mode: "INTERPRET",
      outputType: "behavioral_insight",
      maxTokens: 450,
      temperature: 0.22,
      fallbackKey: "fallback.behavioral_insight",
      buildUserPrompt: (ctx) => `Behavior analysis. Context: ${JSON.stringify(ctx)}`,
    });
  }

  registerDoc3Contract("CAPABILITY_SUMMARY", {
    name: "capability.summary.v1",
    version: "1.0",
    mode: "EXPLAIN",
    outputType: "academy_skill_assessment",
    maxTokens: 350,
    temperature: 0.2,
    fallbackKey: "fallback.capability_summary",
    buildUserPrompt: (ctx) =>
      `Tier: ${String(ctx["tier"] ?? "starter")}. Return academy_skill_assessment JSON with encouragement.`,
  });

  const academy = getContract("ACADEMY_SUPPORT");
  if (academy) {
    api.register({ ...academy, triggerType: "ACADEMY_CONTENT", name: "academy.content.v1" });
  }

  registerDoc3Contract("VALIDATION_RESEARCH_MARKET", {
    name: "validation.market.v1",
    version: "1.0",
    mode: "STRUCTURE",
    outputType: "erector_market",
    maxTokens: 1200,
    temperature: 0.25,
    fallbackKey: "fallback.validation_market",
    buildUserPrompt: (ctx) =>
      `Market validation research. Use facts only unless web search enabled. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("VALIDATION_RESEARCH_COMPETITORS", {
    name: "validation.competitors.v1",
    version: "1.0",
    mode: "STRUCTURE",
    outputType: "erector_competitors",
    maxTokens: 1200,
    temperature: 0.25,
    fallbackKey: "fallback.validation_competitors",
    buildUserPrompt: (ctx) => `Competitor research. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("VALIDATION_ANALYZE_DEMAND", {
    name: "validation.demand.v1",
    version: "1.0",
    mode: "INTERPRET",
    outputType: "erector_market",
    maxTokens: 1000,
    temperature: 0.25,
    fallbackKey: "fallback.validation_demand",
    buildUserPrompt: (ctx) => `Demand analysis. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("VALIDATION_BUILD_PATHS", {
    name: "validation.paths.v1",
    version: "1.0",
    mode: "STRUCTURE",
    outputType: "erector_paths",
    maxTokens: 900,
    temperature: 0.22,
    fallbackKey: "fallback.validation_paths",
    buildUserPrompt: (ctx) =>
      `Build one basic path from goal and timeframe. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("ERECTOR_ACADEMY_CONTENT", {
    name: "erector.academy.v1",
    version: "1.0",
    mode: "DRAFT",
    outputType: "academy_instruction",
    maxTokens: 600,
    temperature: 0.25,
    fallbackKey: "fallback.academy_instruction",
    buildUserPrompt: (ctx) => `Erector academy concept. Context: ${JSON.stringify(ctx)}`,
  });

  registerDoc3Contract("ERECTOR_SIMULATION_EVENT", {
    name: "erector.simulation.v1",
    version: "1.0",
    mode: "DRAFT",
    outputType: "restart_copy",
    maxTokens: 350,
    temperature: 0.3,
    fallbackKey: "fallback.erector_simulation",
    buildUserPrompt: (ctx) =>
      `NPC encouragement + next action. Return restart_copy JSON. Context: ${JSON.stringify(ctx)}`,
  });
}
