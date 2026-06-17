/**
 * Bhudhi live intelligence smoke tests — registry, policy, fallbacks, logging semantics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../lib/bhudhi/ContextBuilder.js", () => ({
  ContextBuilder: {
    buildRouterContext: vi.fn().mockResolvedValue({
      trigger_type: "TASK_DRAFTING",
      state_version: 1,
      input: { domain: "delivery", condition: "urgency" },
    }),
  },
}));

import {
  CORE_DOC12_TRIGGER_COUNT,
  ERECTOR_TRIGGER_TYPES,
  REGISTERED_TRIGGERS,
  resolveCanonicalTriggerType,
} from "../../../lib/bhudhi/TriggerRegistry.js";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  isProviderConfigured,
  mapFailureToValidationStatus,
  resolveBhudhiRuntimePolicy,
} from "../../../lib/bhudhi/BhudhiRuntimePolicy.js";

describe("bhudhi-smoke — trigger registry", () => {
  it("registers core DOC12 router triggers", () => {
    expect(CORE_DOC12_TRIGGER_COUNT).toBe(10);
  });

  it("registers required Erector triggers in canonical registry", () => {
    const required = [
      "ERECTOR_FREE_VALIDATION",
      "ERECTOR_PAID_VALIDATION",
      "ERECTOR_FREE_VERDICT_EXPLAIN",
      "ERECTOR_VERDICT_EXPLAIN",
      "ERECTOR_STATE_EXPLANATION",
    ];
    for (const trigger of required) {
      expect(trigger in REGISTERED_TRIGGERS).toBe(true);
      expect(ERECTOR_TRIGGER_TYPES).toContain(trigger);
    }
  });

  it("has prompt contracts for core and Erector triggers", () => {
    expect(getContract("GOAL_STRUCTURING")).not.toBeNull();
    expect(getContract("TASK_DRAFTING")).not.toBeNull();
    expect(getContract("ERECTOR_FREE_VALIDATION")).not.toBeNull();
    expect(getContract("ERECTOR_VERDICT_EXPLAIN")).not.toBeNull();
    expect(getContract("ERECTOR_VERDICT_EXPLANATION")).not.toBeNull();
  });

  it("resolves legacy ERECTOR_VERDICT_EXPLANATION alias", () => {
    expect(resolveCanonicalTriggerType("ERECTOR_VERDICT_EXPLANATION")).toBe(
      "ERECTOR_VERDICT_EXPLAIN",
    );
  });
});

describe("bhudhi-smoke — runtime policy", () => {
  const originalKey = process.env["ANTHROPIC_API_KEY"];

  afterEach(() => {
    if (originalKey === undefined) delete process.env["ANTHROPIC_API_KEY"];
    else process.env["ANTHROPIC_API_KEY"] = originalKey;
    vi.restoreAllMocks();
  });

  it("detects provider configuration", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    delete process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
    expect(isProviderConfigured()).toBe(false);
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    expect(isProviderConfigured()).toBe(true);
  });

  it("maps fallback failures to validation status classes", () => {
    expect(mapFailureToValidationStatus("bhudhi_force_fallbacks", true)).toBe("forced_fallback");
    expect(mapFailureToValidationStatus("Daily token budget exhausted", true)).toBe(
      "budget_blocked",
    );
    expect(mapFailureToValidationStatus("BHUDHI_NO_API_KEY", true)).toBe("provider_error");
    expect(mapFailureToValidationStatus("Schema validation failed", true)).toBe("schema_error");
  });

  it("uses forced fallback when bhudhi_force_fallbacks flag is enabled", async () => {
    const budgetMod = await import("../../../lib/bhudhi/BudgetController.js");
    vi.spyOn(budgetMod, "isGlobalFallbackMode").mockResolvedValue(true);
    const utils = await import("../../../lib/utils.js");
    vi.spyOn(utils, "checkFeatureFlag").mockImplementation(async (name) =>
      name === "degraded_mode" ? false : false,
    );
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    const policy = await resolveBhudhiRuntimePolicy();
    expect(policy.forceFallback).toBe(true);
    expect(policy.mode).toBe("forced_fallback");
  });
});

describe("bhudhi-smoke — forced fallback logging", () => {
  it("logs forced fallback instead of silent empty logId", async () => {
    const policyMod = await import("../../../lib/bhudhi/BhudhiRuntimePolicy.js");
    vi.spyOn(policyMod, "resolveBhudhiRuntimePolicy").mockResolvedValue({
      allowLiveProvider: false,
      forceFallback: true,
      reason: "bhudhi_force_fallbacks",
      mode: "forced_fallback",
      providerConfigured: true,
    });

    const budget = await import("../../../lib/bhudhi/BudgetController.js");
    vi.spyOn(budget.BudgetController, "checkAndReserve").mockResolvedValue(true);

    const usage = await import("../../../bhudhi/UsageController.js");
    const logSpy = vi.spyOn(usage, "logUsage").mockResolvedValue("log-forced-fallback");

    const { bhudhiTriggerRouter } = await import("../../../lib/bhudhi/BhudhiTriggerRouter.js");
    const result = await bhudhiTriggerRouter.trigger({
      triggerType: "TASK_DRAFTING",
      sourceEngine: "TASK_GENERATION",
      userId: "00000000-0000-0000-0000-000000000099",
      stateVersion: 1,
      input: { domain: "delivery", condition: "urgency" },
      idempotencyKey: "bhudhi-smoke-forced",
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.logId).toBe("log-forced-fallback");
    expect(result.failureReason).toBe("bhudhi_force_fallbacks");
    expect(logSpy).toHaveBeenCalled();
  });
});
