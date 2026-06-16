import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/index.mjs";
import { BHUDHI_MODEL } from "../anthropic.js";
import { logger } from "../logger.js";

const DEFAULT_TIMEOUT_MS = 30_000;

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

function countWebSearchUses(content: Array<{ type: string }>): number {
  return content.filter((b) => b.type === "web_search_tool_result" || b.type === "server_tool_use").length;
}

/** Sole Anthropic Messages API entry (DOC12 ProviderAdapter). */
export async function invokeAnthropicModel(params: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  timeoutMs: number;
  webSearchEnabled?: boolean;
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  intelligenceGrounded: boolean;
  searchQueries: string[];
}> {
  const client = getAnthropicClient();
  const timeoutMs = params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS;
  const body: MessageCreateParamsNonStreaming = {
    model: BHUDHI_MODEL,
    max_tokens: params.maxTokens,
    temperature: params.temperature ?? 0.2,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userPrompt }],
    ...(params.webSearchEnabled
      ? {
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as never],
        }
      : {}),
  };

  const response = await Promise.race([
    client.messages.create(body),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("BHUDHI_TIMEOUT")), timeoutMs),
    ),
  ]);

  const text = extractTextBlocks(response).trim();
  if (!text) throw new Error("BHUDHI_MODEL_EMPTY");

  const searchQueries: string[] = [];
  for (const block of response.content) {
    if (block.type === "web_search_tool_result" && "query" in block) {
      searchQueries.push(String((block as { query?: string }).query ?? ""));
    }
  }

  const webSearchCalls = countWebSearchUses(response.content);
  return {
    text,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    webSearchCalls,
    intelligenceGrounded: webSearchCalls > 0,
    searchQueries: searchQueries.filter(Boolean),
  };
}

export const ProviderAdapter = {
  call: invokeAnthropicModel,
};
