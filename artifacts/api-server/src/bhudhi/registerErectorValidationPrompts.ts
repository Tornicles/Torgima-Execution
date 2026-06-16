/**
 * DOC B3 — Erector free/paid validation and state explanation prompt contracts.
 */
import type { PromptContract } from "./PromptRegistry.js";
import { envelopeSchema } from "./schemas/outputSchemas.js";
import { stateExplanationDataSchema } from "./schemas/outputSchemas.js";
import {
  ErectorFreeOutputSchema,
  ErectorPaidOutputSchema,
} from "./schemas/erector-schemas.js";
import { ERECTOR_JSON_PREFIX } from "./erectorWebSearch.js";

const STANDARD_SYSTEM_HEADER = `You are Bhudhi inside Torgima — a controlled execution intelligence system.
You are NOT a chatbot. You are NOT the system authority.
You interpret, structure, draft, and explain inside the provided constraints.
You must obey allowedActions and forbiddenActions in the context.
You must NOT change state, approve proof, override enforcement, decide conditions, calculate signals, create unauthorized tasks, or invent unavailable data.
Return ONLY the required JSON format. No markdown. No explanation outside JSON. No preamble.`;

const ERECTOR_VALIDATION_RULES =
  "\nThe rule engine owns all scores and launch decisions. Use probability language only. Never claim to mutate signals, conditions, or blueprint state.";

export const ERECTOR_FREE_SYSTEM_PROMPT =
  ERECTOR_JSON_PREFIX +
  STANDARD_SYSTEM_HEADER +
  ERECTOR_VALIDATION_RULES +
  "\nYou interpret a 5-question Erector free validation intake and produce a quick assessment report.";

export const ERECTOR_PAID_SYSTEM_PROMPT =
  ERECTOR_JSON_PREFIX +
  STANDARD_SYSTEM_HEADER +
  ERECTOR_VALIDATION_RULES +
  "\nYou structure an 8-section Erector paid validation intake into a deep intelligence report.";

export const ERECTOR_STATE_EXPLAIN_SYSTEM_PROMPT =
  STANDARD_SYSTEM_HEADER +
  ERECTOR_VALIDATION_RULES +
  "\nYou explain the customer's Erector validation report state in plain language without changing verdicts or scores.";

function buildFreeUserPrompt(ctx: Record<string, unknown>): string {
  return `
Industry: "${String(ctx["industry"] ?? "not provided")}"
Location: "${String(ctx["location"] ?? "not provided")}"
Budget range: "${String(ctx["budget_range"] ?? "not provided")}"
Timeline: "${String(ctx["timeline"] ?? "not provided")}"
Goal: "${String(ctx["rawGoal"] ?? ctx["goal"] ?? "")}"
Purpose: "${String(ctx["purpose"] ?? "")}"

Return ONLY JSON envelope:
{
  "outputType": "erector_free_report",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "verdict": "proceed|adjust|pivot",
    "validation_score": 0,
    "top_strengths": [],
    "top_risks": [],
    "primary_direction": "",
    "alternative_direction": "",
    "success_conditions": [],
    "failure_warnings": [],
    "section_recommendation": "",
    "section_health_score_breakdown": "",
    "section_market_reality": "",
    "section_financial_assessment": "",
    "section_execution_reality": "",
    "section_strengths": "",
    "section_risk_flags": "",
    "section_best_direction": "",
    "section_alternative_direction": "",
    "section_success_conditions": "",
    "section_failure_warnings": ""
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
}

function buildPaidUserPrompt(ctx: Record<string, unknown>): string {
  const sections = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((n) => `Section ${n}: ${JSON.stringify(ctx[`section_${n}_data`] ?? {})}`)
    .join("\n");

  return `
${sections}

Return ONLY JSON envelope:
{
  "outputType": "erector_paid_report",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "verdict": "proceed|adjust|pivot",
    "validation_score": 0,
    "top_strengths": [],
    "top_risks": [],
    "primary_direction": "",
    "alternative_direction": "",
    "success_conditions": [],
    "failure_warnings": [],
    "section_recommendation": "",
    "section_health_score_breakdown": "",
    "section_market_reality": "",
    "section_financial_assessment": "",
    "section_execution_reality": "",
    "section_strengths": "",
    "section_risk_flags": "",
    "section_best_direction": "",
    "section_alternative_direction": "",
    "section_success_conditions": "",
    "section_failure_warnings": "",
    "goal_structured": { "cleaned_goal": "", "measurable_outcome": "", "feasibility_note": "" },
    "purpose_structured": { "problem": "", "target_user": "", "change": "", "value": "" },
    "risk_flags": [],
    "policy_rules": [],
    "winning_conditions": [],
    "failure_conditions": [],
    "selected_path": "current|adjusted|alternative",
    "section_strategy_recommendation": "",
    "section_competitive_position": "",
    "section_90_day_action_map": ""
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
}

function buildStateExplainUserPrompt(ctx: Record<string, unknown>): string {
  return `
Validation verdict: ${String(ctx["verdict"] ?? "adjust")}
Validation score: ${ctx["validation_score"] ?? "unknown"}
Primary direction: "${String(ctx["primary_direction"] ?? "")}"
Top risks: ${JSON.stringify(ctx["top_risks"] ?? [])}

Explain this Erector validation snapshot to the customer. Return ONLY JSON:
{
  "outputType": "state_explanation",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "headline": "short headline (max 60 chars)",
    "explanation": "plain language explanation (max 200 chars)",
    "nextActionReason": "why the next step matters (max 120 chars)",
    "displayTone": "CALM|DIRECT|RECOVERY|FOCUSED"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`;
}

export const ERECTOR_VALIDATION_CONTRACTS: PromptContract[] = [
  {
    name: "erector.free.validate.v1",
    version: "1.0",
    triggerType: "ERECTOR_FREE_VALIDATION",
    provider: "claude",
    mode: "INTERPRET",
    outputType: "erector_free_report",
    maxTokens: 2000,
    temperature: 0.25,
    timeoutMs: 15_000,
    memoryAllowed: false,
    fallbackKey: "ERECTOR_FREE_FALLBACK",
    systemPrompt: ERECTOR_FREE_SYSTEM_PROMPT,
    buildUserPrompt: buildFreeUserPrompt,
    outputSchema: envelopeSchema("erector_free_report", ErectorFreeOutputSchema),
    allowedSources: ["INTERNAL"],
  },
  {
    name: "erector.paid.validate.v1",
    version: "1.0",
    triggerType: "ERECTOR_PAID_VALIDATION",
    provider: "claude",
    mode: "STRUCTURE",
    outputType: "erector_paid_report",
    maxTokens: 4000,
    temperature: 0.22,
    timeoutMs: 30_000,
    memoryAllowed: false,
    fallbackKey: "ERECTOR_PAID_FALLBACK",
    systemPrompt: ERECTOR_PAID_SYSTEM_PROMPT,
    buildUserPrompt: buildPaidUserPrompt,
    outputSchema: envelopeSchema("erector_paid_report", ErectorPaidOutputSchema),
    allowedSources: ["INTERNAL"],
  },
  {
    name: "erector.state.explain.v1",
    version: "1.0",
    triggerType: "ERECTOR_STATE_EXPLANATION",
    provider: "claude",
    mode: "EXPLAIN",
    outputType: "state_explanation",
    maxTokens: 600,
    temperature: 0.2,
    timeoutMs: 10_000,
    memoryAllowed: false,
    fallbackKey: "ERECTOR_STATE_EXPLAIN_FALLBACK",
    systemPrompt: ERECTOR_STATE_EXPLAIN_SYSTEM_PROMPT,
    buildUserPrompt: buildStateExplainUserPrompt,
    outputSchema: envelopeSchema("state_explanation", stateExplanationDataSchema),
    allowedSources: ["INTERNAL"],
  },
  {
    name: "erector.verdict.explain.v1",
    version: "1.0",
    triggerType: "ERECTOR_VERDICT_EXPLANATION",
    provider: "claude",
    mode: "EXPLAIN",
    outputType: "erector_verdict_explanation",
    maxTokens: 800,
    temperature: 0.2,
    timeoutMs: 10_000,
    memoryAllowed: false,
    fallbackKey: "ERECTOR_VERDICT_EXPLANATION_FALLBACK",
    systemPrompt:
      ERECTOR_STATE_EXPLAIN_SYSTEM_PROMPT +
      "\nUse customer language only: say 'Your project' not 'the blueprint', 'Your Recommendation' not 'verdict', 'Project Status' not 'condition'.",
    buildUserPrompt: (ctx) => `
Your Recommendation: ${String(ctx["verdict"] ?? "adjust")}
Project scores (summary only): ${JSON.stringify(ctx["scores"] ?? {})}
Hard blockers: ${JSON.stringify(ctx["hard_blockers"] ?? [])}
Correction required: ${String(ctx["correction_required"] ?? "none")}

Return ONLY JSON:
{
  "outputType": "erector_verdict_explanation",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "HIGH",
  "data": {
    "user_facing_summary": "plain summary for the customer (max 120 chars)",
    "plain_language_reason": "why this recommendation was made (max 250 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
    allowedSources: ["INTERNAL"],
  },
  {
    name: "erector.free.verdict.explain.v1",
    version: "1.0",
    triggerType: "ERECTOR_FREE_VERDICT_EXPLAIN",
    provider: "claude",
    mode: "EXPLAIN",
    outputType: "erector_verdict_explanation",
    maxTokens: 500,
    temperature: 0.2,
    timeoutMs: 10_000,
    memoryAllowed: false,
    fallbackKey: "ERECTOR_FREE_VERDICT_EXPLAIN_FALLBACK",
    systemPrompt:
      ERECTOR_STATE_EXPLAIN_SYSTEM_PROMPT +
      "\nThis is a FREE TIER PREVIEW only — five intake answers. Never show demand proof scores. Use customer language: 'Project Intelligence Preview', 'Market Potential', 'Resource Fit'.",
    buildUserPrompt: (ctx) => `
Preview badge: Project Intelligence Preview
Preview label: ${String(ctx["preview_verdict_label"] ?? "Some Gaps to Address")}
Market viability: ${String(ctx["market_viability_score"] ?? 0)}
Feasibility: ${String(ctx["feasibility_score"] ?? 0)}
Soft warnings: ${JSON.stringify(ctx["soft_warnings"] ?? [])}

Return ONLY JSON:
{
  "outputType": "erector_verdict_explanation",
  "contractVersion": "1.0",
  "stateVersion": ${ctx["stateVersion"] ?? 0},
  "confidence": "MEDIUM",
  "data": {
    "user_facing_summary": "preview headline for the customer (max 120 chars)",
    "plain_language_reason": "explain preview limits and encourage upgrade (max 280 chars)"
  },
  "missingFields": [],
  "warnings": [],
  "forbiddenActionRequested": false
}`,
    allowedSources: ["INTERNAL"],
  },
];

export function registerErectorValidationPrompts(
  register: (contract: PromptContract) => void,
): void {
  for (const contract of ERECTOR_VALIDATION_CONTRACTS) {
    register(contract);
  }
}
