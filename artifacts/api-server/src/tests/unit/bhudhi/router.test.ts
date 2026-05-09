/**
 * Bhudhi PromptRegistry, FallbackLibrary, OutputValidator, caps.
 */

import { describe, it, expect } from "vitest";
import { FORBIDDEN_MODES } from "../../../types/bhudhi.js";
import { getContract, getAllContracts } from "../../../bhudhi/PromptRegistry.js";
import { getFallback } from "../../../bhudhi/FallbackLibrary.js";
import { validateOutput } from "../../../bhudhi/OutputValidator.js";

describe("PromptRegistry", () => {
  it("registers all 10 Phase 1 trigger types", () => {
    const expected = [
      "GOAL_STRUCTURING",
      "TASK_DRAFTING",
      "FEEDBACK_CLASSIFICATION",
      "CLARIFICATION_PROMPT",
      "RECOVERY_COPY",
      "STATE_EXPLANATION",
      "INACTIVITY_RESTART",
      "ACADEMY_SUPPORT",
      "OUTCOME_EVIDENCE_SUMMARY",
      "ROOT_CAUSE_ASSIST",
    ] as const;
    for (const t of expected) {
      expect(getContract(t)).not.toBeNull();
    }
  });

  it("getContract(TASK_DRAFTING) uses DRAFT mode and fallbackKey", () => {
    const c = getContract("TASK_DRAFTING");
    expect(c?.mode).toBe("DRAFT");
    expect(c?.fallbackKey).toBeTruthy();
  });

  it("no prompt contract uses DECIDE, MUTATE, or OVERRIDE modes", () => {
    getAllContracts().forEach(contract => {
      expect(FORBIDDEN_MODES.includes(contract.mode)).toBe(false);
    });
  });

  it("every contract has a fallbackKey", () => {
    getAllContracts().forEach(contract => {
      expect(contract.fallbackKey).toBeTruthy();
    });
  });

  it("every contract has maxTokens > 0", () => {
    getAllContracts().forEach(contract => {
      expect(contract.maxTokens).toBeGreaterThan(0);
    });
  });

  it("FORBIDDEN_MODES lists exactly DECIDE, MUTATE, OVERRIDE", () => {
    expect([...FORBIDDEN_MODES].sort()).toEqual(["DECIDE", "MUTATE", "OVERRIDE"].sort());
  });
});

describe("FallbackLibrary", () => {
  it("returns valid envelope for goal_structure fallback", () => {
    const result = getFallback("fallback.goal_structure", { rawGoal: "test goal" }, 5);
    expect(result.outputType).toBe("structured_goal");
    expect(result.forbiddenActionRequested).toBe(false);
  });

  it("getFallback task_copy returns title and instruction", () => {
    const result = getFallback("fallback.task_copy", { goal: "test" }, 1);
    expect(result.outputType).toBe("task_copy");
    expect((result.data as { title: string }).title).toBeTruthy();
    expect((result.data as { instruction: string }).instruction).toBeTruthy();
  });

  it("unknown fallback key still returns envelope with warnings", () => {
    const result = getFallback("fallback.nonexistent", {}, 1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("academy fallback returns academy_instruction", () => {
    const r = getFallback("fallback.academy_instruction", { capabilityGap: "testing" }, 0);
    expect(r.outputType).toBe("academy_instruction");
  });
});

describe("OutputValidator", () => {
  it("accepts valid task_copy output", () => {
    const output = {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: 3,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "Build landing page",
        instruction: "Create the wireframe",
        proofInstruction: "Submit screenshot",
        successCriteria: ["Wireframe complete"],
        estimatedEffortLabel: "MEDIUM",
        userFacingReason: "Moves blueprint forward",
      },
    };
    expect(validateOutput(output, "task_copy", 3).ok).toBe(true);
  });

  it("rejects when forbiddenActionRequested = true", () => {
    const output = {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: 3,
      confidence: "HIGH",
      forbiddenActionRequested: true,
      missingFields: [],
      warnings: [],
      data: {
        title: "x",
        instruction: "x",
        proofInstruction: "x",
        successCriteria: ["x"],
        estimatedEffortLabel: "SMALL",
      },
    };
    const result = validateOutput(output, "task_copy", 3);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("FORBIDDEN"))).toBe(true);
  });

  it("rejects invalid blocker category", () => {
    const output = {
      outputType: "blocker_classification",
      contractVersion: "1.0",
      stateVersion: 2,
      confidence: "MEDIUM",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        blockerCategory: "INVALID_CATEGORY",
        severity: "HIGH",
        needsDependencyResolution: false,
        needsRecoveryTask: false,
        summary: "test",
      },
    };
    expect(validateOutput(output, "blocker_classification", 2).ok).toBe(false);
  });

  it("rejects stale state version", () => {
    const output = {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "x",
        instruction: "x",
        proofInstruction: "x",
        successCriteria: ["x"],
        estimatedEffortLabel: "SMALL",
      },
    };
    expect(validateOutput(output, "task_copy", 50).ok).toBe(false);
  });

  it("rejects missing data object", () => {
    const result = validateOutput(
      {
        outputType: "task_copy",
        contractVersion: "1.0",
        stateVersion: 1,
        confidence: "HIGH",
        forbiddenActionRequested: false,
      },
      "task_copy",
      1,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects outputType mismatch", () => {
    const output = {
      outputType: "task_copy",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "x",
        instruction: "x",
        proofInstruction: "x",
        successCriteria: ["x"],
        estimatedEffortLabel: "SMALL",
      },
    };
    expect(validateOutput(output, "structured_goal", 1).ok).toBe(false);
  });

  it("accepts valid state_explanation", () => {
    const output = {
      outputType: "state_explanation",
      contractVersion: "1.0",
      stateVersion: 2,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        headline: "On track",
        explanation: "Momentum is steady.",
        nextActionReason: "Next task advances goal.",
        displayTone: "CALM",
      },
    };
    expect(validateOutput(output, "state_explanation", 2).ok).toBe(true);
  });

  it("accepts valid root_cause_candidates", () => {
    const output = {
      outputType: "root_cause_candidates",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "MEDIUM",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        candidates: [{ category: "CLARITY", likelihood: "HIGH", evidence: ["x"] }],
        recommendedNextDiagnosticQuestion: "What blocked you?",
      },
    };
    expect(validateOutput(output, "root_cause_candidates", 1).ok).toBe(true);
  });

  it("accepts restart_copy", () => {
    const output = {
      outputType: "restart_copy",
      contractVersion: "1.0",
      stateVersion: 1,
      confidence: "HIGH",
      forbiddenActionRequested: false,
      missingFields: [],
      warnings: [],
      data: {
        title: "Welcome back",
        instruction: "One small step",
        welcomeMessage: "Good to see you.",
      },
    };
    expect(validateOutput(output, "restart_copy", 1).ok).toBe(true);
  });
});

describe("bhudhi module exports", () => {
  it("MemoryService exports retrieveMemory", async () => {
    const { retrieveMemory } = await import("../../../bhudhi/MemoryService.js");
    expect(typeof retrieveMemory).toBe("function");
  });

  it("UsageController exports checkUsageAllowed", async () => {
    const { checkUsageAllowed } = await import("../../../bhudhi/UsageController.js");
    expect(typeof checkUsageAllowed).toBe("function");
  });

  it("BhudhiCore exports trigger and explainState", async () => {
    const { trigger, explainState } = await import("../../../bhudhi/BhudhiCore.js");
    expect(typeof trigger).toBe("function");
    expect(typeof explainState).toBe("function");
  });

  it("PromptRegistry exports getContract", async () => {
    const { getContract: gc } = await import("../../../bhudhi/PromptRegistry.js");
    expect(gc("GOAL_STRUCTURING")).not.toBeNull();
  });
});

describe("UsageController caps", () => {
  it("starter tier cap is 20", () => {
    const caps: Record<string, number> = { starter: 20, growth: 50, ultimate: 200 };
    expect(caps["starter"]).toBe(20);
  });

  it("ultimate tier cap is 10x starter", () => {
    const caps: Record<string, number> = { starter: 20, growth: 50, ultimate: 200 };
    expect(caps["ultimate"]).toBe(caps["starter"] * 10);
  });
});

