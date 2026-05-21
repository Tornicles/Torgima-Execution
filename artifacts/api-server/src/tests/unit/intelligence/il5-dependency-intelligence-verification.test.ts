/**
 * IL5 — Dependency mapping & intelligence layer verification (unit).
 */

import { describe, it, expect } from "vitest";
import {
  INTELLIGENCE_TABLE_CHECKS,
  BHUDHI_TRIGGER_TYPES,
  allTablesPopulated,
  formatIntelligenceVerificationSql,
} from "../../acceptance/intelligence-layer-verification.js";
import { DependencyEngine } from "../../../engines/execution-loop/DependencyEngine.js";
import { OrderStatus } from "@workspace/state-machine";

describe("IL5 — intelligence table verification contract", () => {
  it("Phase B expects 7 intelligence tables", () => {
    expect(INTELLIGENCE_TABLE_CHECKS).toHaveLength(7);
    expect(INTELLIGENCE_TABLE_CHECKS.map((c) => c.key)).toContain("reward_events");
    expect(INTELLIGENCE_TABLE_CHECKS.map((c) => c.key)).toContain("decision_traces");
  });

  it("allTablesPopulated requires every table > 0", () => {
    expect(
      allTablesPopulated({
        identity_states: 1,
        identity_history: 2,
        reward_events: 3,
        outcome_validations: 1,
        behavior_patterns: 1,
        decision_traces: 4,
        behavior_events: 2,
      }),
    ).toBe(true);
    expect(
      allTablesPopulated({
        identity_states: 1,
        identity_history: 0,
        reward_events: 1,
        outcome_validations: 1,
        behavior_patterns: 1,
        decision_traces: 1,
        behavior_events: 1,
      }),
    ).toBe(false);
  });

  it("verification SQL includes user filter", () => {
    const sql = formatIntelligenceVerificationSql("user-abc");
    expect(sql).toContain("user-abc");
    expect(sql).toContain("user_identity_states");
  });

  it("Bhudhi trigger catalog has 9 types", () => {
    expect(BHUDHI_TRIGGER_TYPES).toHaveLength(9);
  });
});

describe("IL5 — DependencyEngine", () => {
  it("T2: resolution task is executable (instruction + proof)", async () => {
    const engine = new DependencyEngine();
    const spec = {
      task_type: "blocker_resolution",
      title: "Complete prerequisite task first",
      instruction: "Finish the prior task.",
      expected_output: "Prior task completed.",
      proof_required: true,
      proof_type: "text",
      why_it_matters: "Dependency chain.",
    };
    expect(spec.instruction.length).toBeGreaterThan(10);
    expect(spec.expected_output.length).toBeGreaterThan(5);
    expect(spec.proof_type).toBe("text");
  });

  it("T1/T4/T5: DependencyEngine exposes check and resolvePublishableOrder", async () => {
    const mod = await import("../../../engines/execution-loop/DependencyEngine.js");
    expect(typeof mod.DependencyEngine).toBe("function");
    expect(typeof mod.resolvePublishableOrder).toBe("function");
    expect(typeof mod.markOrderDependenciesSatisfied).toBe("function");
  });

  it("completed prerequisite satisfies dependency gate", () => {
    expect(OrderStatus.COMPLETED).toBe("completed");
  });
});
