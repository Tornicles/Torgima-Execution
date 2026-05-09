import Anthropic from "@anthropic-ai/sdk";
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/index.mjs";
import { logger } from "./logger.js";

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined;
};

function createAnthropicClient(): Anthropic {
  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey =
    process.env["ANTHROPIC_API_KEY"]?.trim() ||
    process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"]?.trim();

  if (!apiKey) {
    logger.warn(
      "ANTHROPIC_API_KEY (or legacy AI_INTEGRATIONS_ANTHROPIC_API_KEY) not set — Bhudhi will not function",
    );
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
  process.env["BHUDHI_MODEL"] ?? "claude-sonnet-4-20250514";

export const BHUDHI_MAX_TOKENS = parseInt(
  process.env.BHUDHI_MAX_TOKENS ?? "4096",
);

/** Single gateway for SDK calls — use `createBhudhiMessage` from engines and Bhudhi. */
export async function createBhudhiMessage(
  body: MessageCreateParamsNonStreaming,
): Promise<Message> {
  const msgs = anthropic.messages;
  type CreateFn = (typeof msgs)["create"];
  const send = msgs["create"] as CreateFn;
  return send.bind(msgs)(body);
}
