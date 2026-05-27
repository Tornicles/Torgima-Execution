import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ERECTOR_BHUDHI_CALLS } from "../../../bhudhi/erector-prompts.js";
import {
  ERECTOR_SEARCH_TRIGGERS,
  providerForTrigger,
} from "../../../bhudhi/bhudhiProviders.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  appendErectorSearchUserPrompt,
  appendWebSearchInstruction,
  ERECTOR_JSON_PREFIX,
} from "../../../bhudhi/erectorWebSearch.js";
import { BHUDHI_MODEL } from "../../../lib/anthropic.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSrc(rel: string): string {
  return readFileSync(path.join(apiRoot, rel), "utf8");
}

describe("Bhudhi provider routing (Anthropic only)", () => {
  it("maps all Erector calls to Claude", () => {
    expect(ERECTOR_BHUDHI_CALLS.every((c) => c.provider === "claude")).toBe(true);
    expect(ERECTOR_BHUDHI_CALLS.length).toBe(10);
  });

  it("providerForTrigger always returns claude", () => {
    for (const trigger of ERECTOR_SEARCH_TRIGGERS) {
      expect(providerForTrigger(trigger)).toBe("claude");
    }
    expect(providerForTrigger("TASK_DRAFTING")).toBe("claude");
  });

  it("registers Claude on Erector search-enriched contracts when present", () => {
    for (const trigger of ERECTOR_SEARCH_TRIGGERS) {
      const contract = getContract(trigger);
      if (contract) {
        expect(contract.provider ?? providerForTrigger(trigger)).toBe("claude");
      } else {
        expect(providerForTrigger(trigger)).toBe("claude");
      }
    }
  });

  it("prepends JSON prefix and search blocks for Erector research prompts", () => {
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

  it("TriggerRouter uses Anthropic SDK only — no Gemini", () => {
    const triggerRouter = readSrc("src/bhudhi/TriggerRouter.ts");
    expect(triggerRouter).not.toContain("web_search_20250305");
    expect(triggerRouter).not.toContain("callGeminiRaw");
    expect(triggerRouter).not.toContain("gemini");
    expect(triggerRouter).toContain("invokeAnthropicModel");
    expect(triggerRouter).toContain("invokeBhudhiModel");
    expect(triggerRouter).toContain("BHUDHI_MODEL");
  });

  it("gemini-client.ts is removed", () => {
    expect(existsSync(path.join(apiRoot, "src/bhudhi/gemini-client.ts"))).toBe(false);
  });

  it("BHUDHI_MODEL defaults to claude-sonnet-4-20250514", () => {
    expect(BHUDHI_MODEL).toMatch(/claude/);
  });
});
