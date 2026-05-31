import type { ZodType } from "zod/v4";
import { logger } from "../lib/logger.js";

export function buildCorrectionPrompt(originalUserPrompt: string, validationError: string): string {
  return `${originalUserPrompt}

CORRECTION REQUIRED:
Your previous response failed validation with these errors:
${validationError}

Please regenerate your response fixing these exact issues. Output valid JSON matching the required schema only.`;
}

export async function parseAndValidateWithRetry<T>(params: {
  invoke: () => Promise<{ text: string }>;
  userPrompt: string;
  schema?: ZodType<T>;
  maxAttempts?: number;
  parseText: (text: string) => unknown;
}): Promise<{ data: T; attempts: number } | { error: string; attempts: number }> {
  const max = params.maxAttempts ?? 2;
  let lastError = "";

  for (let attempt = 1; attempt <= max; attempt++) {
    const prompt =
      attempt === 1 ? params.userPrompt : buildCorrectionPrompt(params.userPrompt, lastError);
    const modelResult = await params.invoke();
    if (!modelResult?.text) {
      lastError = "empty_model_response";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = params.parseText(modelResult.text);
    } catch {
      lastError = "json_parse_failure";
      logger.warn({ attempt }, "[BHUDHI] JSON parse failed — retrying");
      continue;
    }

    if (!params.schema) {
      return { data: parsed as T, attempts: attempt };
    }

    const validation = params.schema.safeParse(parsed);
    if (validation.success) {
      return { data: validation.data, attempts: attempt };
    }

    lastError = JSON.stringify(validation.error.issues);
    logger.warn({ attempt }, "[BHUDHI] Schema validation failed — retrying");
  }

  return { error: lastError || "validation_exhausted", attempts: max };
}
