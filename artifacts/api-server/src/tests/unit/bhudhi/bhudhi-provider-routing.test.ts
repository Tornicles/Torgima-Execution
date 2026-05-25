import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERECTOR_BHUDHI_CALLS } from "../../../bhudhi/erector-prompts.js";
import {
  GEMINI_SEARCH_TRIGGERS,
  GEMINI_STANDARD_TRIGGERS,
  providerForTrigger,
} from "../../../bhudhi/bhudhiProviders.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  appendErectorSearchUserPrompt,
  appendWebSearchInstruction,
  ERECTOR_JSON_PREFIX,
} from "../../../bhudhi/erectorWebSearch.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSrc(rel: string): string {
  return readFileSync(path.join(apiRoot, rel), "utf8");
}

describe("Bhudhi provider routing", () => {
  it("maps Erector validation calls to Gemini providers", () => {
    const geminiCalls = ERECTOR_BHUDHI_CALLS.filter((c) => c.provider === "gemini");
    const searchCalls = ERECTOR_BHUDHI_CALLS.filter((c) => c.provider === "gemini-search");
    expect(geminiCalls.length).toBe(6);
    expect(searchCalls.length).toBe(4);
    expect(searchCalls.map((c) => c.callName).sort()).toEqual(
      ["analyze_industry", "analyze_market", "generate_economy_briefing", "identify_competitors"].sort(),
    );
    expect(geminiCalls.map((c) => c.callName).sort()).toEqual(
      [
        "decompose_purpose",
        "generate_first_week",
        "generate_paths",
        "pain_analyze",
        "resolve_archetype",
        "simulate_timeframes",
      ].sort(),
    );
  });

  it("registers provider on Erector prompt contracts", () => {
    for (const trigger of [...GEMINI_STANDARD_TRIGGERS, ...GEMINI_SEARCH_TRIGGERS]) {
      const contract = getContract(trigger);
      expect(contract?.provider).toBe(providerForTrigger(trigger));
      expect(contract?.provider).not.toBe("claude");
    }
  });

  it("prepends JSON prefix and search blocks for gemini-search prompts", () => {
    const industry = getContract("ERECTOR_INDUSTRY_ANALYZE");
    expect(industry?.systemPrompt).toContain("CRITICAL: Your response must be valid JSON only");
    expect(industry?.systemPrompt.startsWith(ERECTOR_JSON_PREFIX.slice(0, 30))).toBe(true);
    const user = appendErectorSearchUserPrompt("ERECTOR_INDUSTRY_ANALYZE", { locationCountry: "Nigeria" }, "base");
    expect(user).toContain("Today's date:");
    expect(user).toContain("SEARCH REQUIREMENT:");
    const competitors = getContract("ERECTOR_COMPETITORS_IDENTIFY");
    expect(
      appendWebSearchInstruction("ERECTOR_COMPETITORS_IDENTIFY", competitors?.systemPrompt ?? ""),
    ).toContain("AUTHENTICITY RULE");
  });

  it("keeps execution triggers on Claude", () => {
    expect(getContract("TASK_DRAFTING")?.provider).toBe("claude");
    expect(getContract("GOAL_STRUCTURING")?.provider).toBe("claude");
    expect(getContract("FEEDBACK_CLASSIFICATION")?.provider).toBe("claude");
  });

  it("removes Anthropic web_search tool from TriggerRouter", () => {
    const triggerRouter = readSrc("src/bhudhi/TriggerRouter.ts");
    expect(triggerRouter).not.toContain("web_search_20250305");
    expect(triggerRouter).toContain("invokeBhudhiModel");
    expect(triggerRouter).toContain("callGeminiRaw");
  });

  it("includes gemini-client.ts with callGeminiRaw", () => {
    const geminiClient = readSrc("src/bhudhi/gemini-client.ts");
    expect(geminiClient).toContain("googleSearch");
    expect(geminiClient).toContain("GEMINI_API_KEY");
    expect(geminiClient).toContain("callGeminiRaw");
  });
});
