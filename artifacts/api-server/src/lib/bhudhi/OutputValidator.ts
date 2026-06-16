import { validateOutput as validateSchemaOutput } from "../../bhudhi/OutputValidator.js";
import type { BhudhiOutputEnvelope } from "../../types/bhudhi.js";
import { REGISTERED_TRIGGERS, type Doc12TriggerType } from "./TriggerRegistry.js";
import { buildSystemPrompt } from "./prompts/SystemPromptBuilder.js";

export const FORBIDDEN_PATTERNS = [
  "I have updated",
  "I have changed",
  "I have set",
  "You must",
  "You need to",
  "You should immediately",
  "bypass",
  "override",
  "ignore the rules",
  "burnout",
  "mentally",
  "psychologically",
  "clinical",
] as const;

const USER_FACING_FIELDS = [
  "headline",
  "explanation",
  "instruction",
  "command",
  "question",
  "title",
  "summary",
  "reason",
  "welcomeMessage",
  "userFacingReason",
  "whyNeeded",
  "nextActionReason",
  "submittedEvidenceSummary",
  "cleanedGoal",
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((v) => collectStrings(v, out));
  }
  return out;
}

function trimUserFacingCopy(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  for (const field of USER_FACING_FIELDS) {
    const value = next[field];
    if (typeof value === "string" && value.length > 500) {
      next[field] = value.slice(0, 500);
    }
  }
  return next;
}

function findForbiddenPatterns(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_PATTERNS.filter((pattern) => lower.includes(pattern.toLowerCase()));
}

export interface Doc12ValidationResult {
  ok: boolean;
  output?: BhudhiOutputEnvelope;
  errors: string[];
}

export function validateDoc12Output(
  raw: unknown,
  triggerType: Doc12TriggerType,
  expectedStateVersion: number,
): Doc12ValidationResult {
  const errors: string[] = [];
  const def = REGISTERED_TRIGGERS[triggerType];

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, errors: ["Output is not valid JSON"] };
    }
  }

  const schemaResult = validateSchemaOutput(parsed, def.outputType, expectedStateVersion);
  if (!schemaResult.ok) {
    return { ok: false, errors: schemaResult.errors };
  }

  const envelope = parsed as BhudhiOutputEnvelope;
  const patternHits = findForbiddenPatterns(collectStrings(envelope).join("\n"));
  if (patternHits.length > 0) {
    errors.push(`Forbidden output pattern: ${patternHits[0]}`);
    return { ok: false, errors };
  }

  if (envelope.data && typeof envelope.data === "object") {
    envelope.data = trimUserFacingCopy(envelope.data as Record<string, unknown>);
  }

  return { ok: true, output: envelope, errors: [] };
}

export function validateRawModelText(
  rawText: string,
  triggerType: Doc12TriggerType,
  expectedStateVersion: number,
): Doc12ValidationResult {
  return validateDoc12Output(rawText, triggerType, expectedStateVersion);
}

export const OutputValidator = {
  validate: validateDoc12Output,
  validateRawModelText,
  forbiddenPatterns: FORBIDDEN_PATTERNS,
};

export { buildSystemPrompt };
