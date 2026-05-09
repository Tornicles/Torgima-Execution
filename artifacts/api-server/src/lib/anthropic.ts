import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

function createAnthropicClient(): Anthropic {
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn("AI_INTEGRATIONS_ANTHROPIC_API_KEY not set — Bhudhi will not function");
  }

  return new Anthropic({
    apiKey: apiKey ?? "placeholder",
    ...(baseURL ? { baseURL } : {}),
  });
}

export const anthropic =
  globalForAnthropic.anthropic ?? createAnthropicClient();

if (process.env.NODE_ENV !== "production") {
  globalForAnthropic.anthropic = anthropic;
}

export const BHUDHI_MODEL =
  process.env.BHUDHI_MODEL ?? "claude-sonnet-4-6";

export const BHUDHI_MAX_TOKENS = parseInt(
  process.env.BHUDHI_MAX_TOKENS ?? "4096",
);
