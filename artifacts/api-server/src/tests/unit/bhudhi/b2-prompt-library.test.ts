/**
 * Bhudhi B2 — Prompt registry, Zod validation, and fallbacks.
 */
import { describe, it, expect } from "vitest";
import { PromptRegistry, getContract, getContractByName } from "../../../bhudhi/PromptRegistry.js";
import { OutputValidator, validateFromContract } from "../../../bhudhi/OutputValidator.js";
import { FallbackLibrary, getFallback } from "../../../bhudhi/FallbackLibrary.js";
import { getFallbackCoverageReport } from "../../../bhudhi/FallbackRegistry.js";
import { mapBhudhiTriggerToRequestType } from "../../../bhudhi/bhudhiLogMapping.js";
import { CORE_TRIGGER_TYPES } from "../../../bhudhi/schemas/outputSchemas.js";

const CORE_TRIGGER_NAMES = [
  "goal.structure.v1",
  "task.draft.v3",
  "task.clarification.v1",
  "task.recovery.v1",
  "feedback.blocker.v1",
  "state.explain.v1",
  "inactivity.restart.v1",
  "academy.instruction.v1",
  "outcome.evidence_summary.v1",
  "failure.root_candidates.v1",
  "goal.missing_fields.v1",
] as const;

describe("B2 PromptRegistry (T1)", () => {
  it("lists at least 12 registry entries and covers all core trigger types", () => {
    const keys = PromptRegistry.list();
    expect(keys.length).toBeGreaterThanOrEqual(12);

    for (const trigger of CORE_TRIGGER_TYPES) {
      expect(getContract(trigger)).not.toBeNull();
    }
  });

  it("resolves all 12 core named contracts", () => {
    for (const name of CORE_TRIGGER_NAMES) {
      expect(getContractByName(name)).not.toBeNull();
    }
  });

  it("every primary contract has outputSchema and fallbackKey", () => {
    for (const trigger of CORE_TRIGGER_TYPES) {
      const c = getContract(trigger);
      expect(c?.outputSchema).toBeDefined();
      expect(c?.fallbackKey).toBeTruthy();
    }
  });
});

describe("B2 OutputValidator (T2, T3)", () => {
  it("valid structured_goal JSON passes schema validation", () => {
    const valid = JSON.stringify({
      outputType: "structured_goal",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "HIGH",
      data: {
        cleanedGoal: "Launch a SaaS for freelancers",
        purpose: "Time tracking",
        timeframe: "6 months",
        commitmentLevel: "HIGH",
        domainHints: ["market"],
        ambiguityFlags: [],
        missingRequiredFields: [],
      },
      missingFields: [],
      warnings: [],
      forbiddenActionRequested: false,
    });

    const result = validateFromContract(valid, "goal.structure.v1");
    expect(result.ok).toBe(true);
    expect((result.data as { data: { cleanedGoal: string } }).data.cleanedGoal).toContain("SaaS");
  });

  it("invalid JSON fails validation", () => {
    const result = validateFromContract("{broken json", "goal.structure.v1");
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toMatch(/JSON/i);
  });
});

describe("B2 FallbackLibrary (T3, T5)", () => {
  it("invalid output path uses deterministic fallback for GOAL_STRUCTURING", () => {
    const broken = validateFromContract("{nope", "goal.structure.v1");
    expect(broken.ok).toBe(false);

    const fb = FallbackLibrary.get<Record<string, unknown>>("GOAL_STRUCTURING", {
      rawGoal: "Build an app",
    });
    expect(fb.cleanedGoal).toBeTruthy();
  });

  it("all primary fallbacks pass envelope validation", () => {
    const report = getFallbackCoverageReport();
    expect(report.missing.length).toBe(0);

    for (const trigger of CORE_TRIGGER_TYPES) {
      const contract = getContract(trigger)!;
      const envelope = getFallback(contract.fallbackKey, { rawGoal: "test", goal: "test" }, 1);
      const legacy = OutputValidator.validateEnvelope(
        envelope,
        contract.outputType,
        envelope.stateVersion,
      );
      expect(legacy.ok, `${trigger}: ${legacy.errors.join("; ")}`).toBe(true);
    }
  });
});

describe("B2 advanced intelligence prompts (T4)", () => {
  it("ROOT_CAUSE_ASSIST INTERPRET variant is registered", () => {
    const contract = PromptRegistry.lookup("ROOT_CAUSE_ASSIST", "INTERPRET");
    expect(contract).not.toBeNull();
    expect(contract?.name).toBe("failure.root_investigate.v1");
  });

  it("registers extended intelligence aliases by name", () => {
    expect(getContractByName("feedback.critic.v1")).not.toBeNull();
    expect(getContractByName("state.coaching.v1")).not.toBeNull();
    expect(getContractByName("goal.eis_extended.v1")).not.toBeNull();
    expect(getContractByName("task.simulation.v1")).not.toBeNull();
  });
});

describe("B5 — bhudhi_logs request_type mapping", () => {
  it("maps core triggers to legacy request_type enum values", () => {
    expect(mapBhudhiTriggerToRequestType("GOAL_STRUCTURING")).toBe("goal_validation");
    expect(mapBhudhiTriggerToRequestType("TASK_DRAFTING")).toBe("task_generation");
    expect(mapBhudhiTriggerToRequestType("FEEDBACK_CLASSIFICATION")).toBe("feedback_interpretation");
    expect(mapBhudhiTriggerToRequestType("CLARIFICATION_PROMPT")).toBe("feedback_interrogation");
    expect(mapBhudhiTriggerToRequestType("RECOVERY_COPY")).toBe("recovery_suggestion");
    expect(mapBhudhiTriggerToRequestType("STATE_EXPLANATION")).toBe("condition_explanation");
    expect(
      mapBhudhiTriggerToRequestType("STATE_EXPLANATION", { sourceEngine: "DASHBOARD" }),
    ).toBe("dashboard_summary");
  });
});
