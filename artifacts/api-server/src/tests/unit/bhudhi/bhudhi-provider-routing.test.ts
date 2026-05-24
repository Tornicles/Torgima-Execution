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

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSrc(rel: string): string {
  return readFileSync(path.join(apiRoot, rel), "utf8");
}

describe("Bhudhi provider routing", () => {
  it("maps Erector validation calls to Gemini providers", () => {
    const geminiCalls = ERECTOR_BHUDHI_CALLS.filter((c) => c.provider === "gemini");
    const searchCalls = ERECTOR_BHUDHI_CALLS.filter((c) => c.provider === "gemini-search");
    expect(geminiCalls.length).toBeGreaterThanOrEqual(5);
    expect(searchCalls.length).toBe(5);
    expect(searchCalls.map((c) => c.callName).sort()).toEqual(
      [
        "analyze_execution_and_timing",
        "analyze_industry",
        "analyze_market",
        "generate_economy_briefing",
        "identify_competitors",
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

  it("keeps execution triggers on Claude", () => {
    expect(getContract("TASK_DRAFTING")?.provider ?? providerForTrigger("TASK_DRAFTING")).toBe("claude");
    expect(getContract("GOAL_STRUCTURING")?.provider ?? providerForTrigger("GOAL_STRUCTURING")).toBe("claude");
    expect(getContract("FEEDBACK_CLASSIFICATION")?.provider ?? providerForTrigger("FEEDBACK_CLASSIFICATION")).toBe(
      "claude",
    );
  });

  it("removes Anthropic web_search tool from TriggerRouter", () => {
    const triggerRouter = readSrc("src/bhudhi/TriggerRouter.ts");
    expect(triggerRouter).not.toContain("web_search_20250305");
    expect(triggerRouter).toContain("invokeBhudhiModel");
    expect(triggerRouter).toContain("callGeminiWithSearch");
  });

  it("includes gemini-client.ts", () => {
    const geminiClient = readSrc("src/bhudhi/gemini-client.ts");
    expect(geminiClient).toContain("googleSearch");
    expect(geminiClient).toContain("GEMINI_API_KEY");
  });
});
