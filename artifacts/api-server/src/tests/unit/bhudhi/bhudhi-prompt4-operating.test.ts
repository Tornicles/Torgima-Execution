import { describe, it, expect } from "vitest";
import { BHUDHI_ENGINES } from "@workspace/db/bhudhi-seed-data";
import { OPERATING_ENGINE_NAMES } from "../../../bhudhi/operating/types.js";
import {
  changeControlEngine,
  schedulingEngine,
  gradualRolloutEngine,
  actionExecutorEngine,
  errorRecoveryEngine,
  performanceOptimizerEngine,
  complianceEnforcerEngine,
  resourceAllocatorEngine,
  workflowOrchestratorEngine,
} from "../../../bhudhi/operating/operatingEngines.js";
import { validateBeforeExecution } from "../../../bhudhi/operating/securityGate.js";
import type { OperatingRecommendation } from "../../../bhudhi/operating/types.js";

const baseRec: OperatingRecommendation = {
  id: "rec-1",
  blueprintId: "bp-1",
  engineId: "int_recommendation_engine",
  title: "Maintain operational efficiency",
  description: "Based on SYNERGYOPS framework analysis",
  reasoning: "Framework detected: Execution smooth",
  expectedImpact: { revenue: 5000, efficiency: 40, risk: 20, timeline: 14 },
  confidence: 0.82,
  implementationDifficulty: "easy",
  status: "approved",
  risks: { probability: 0.2, severity: "low", mitigation: "plan", contingency: "ready" },
  feasibility: { feasible: true, difficulty: "easy", resources: "Available", timeline: "4 weeks", effort: "20h" },
  strategicAlignment: { aligned: true, alignmentScore: 0.87, strategicValue: "High", constraints: [] },
};

describe("BHUDHI PROMPT 4 — Operating System", () => {
  it("seed defines 10 operating engines with Prompt 4 names", () => {
    const ops = BHUDHI_ENGINES.filter((e) => e.systemId === "operating");
    expect(ops).toHaveLength(10);
    for (const name of OPERATING_ENGINE_NAMES) {
      expect(ops.some((e) => e.name === name)).toBe(true);
    }
  });

  it("security gate blocks non-approved and forbidden phrases", () => {
    const pending = validateBeforeExecution({ ...baseRec, status: "pending" });
    expect(pending.allowed).toBe(false);

    const forbidden = validateBeforeExecution({
      ...baseRec,
      title: "Override enforcement limits",
    });
    expect(forbidden.allowed).toBe(false);

    const ok = validateBeforeExecution(baseRec);
    expect(ok.allowed).toBe(true);
  });

  it("change control rejects high risk / budget", () => {
    expect(changeControlEngine(baseRec)).toBe(true);
    expect(
      changeControlEngine({
        ...baseRec,
        expectedImpact: { revenue: 200_000 },
        risks: { probability: 0.2, severity: "low", mitigation: "", contingency: "" },
      }),
    ).toBe(false);
    expect(
      changeControlEngine({
        ...baseRec,
        risks: { probability: 0.9, severity: "high", mitigation: "", contingency: "" },
      }),
    ).toBe(false);
  });

  it("scheduling and rollout produce phased plan", () => {
    const schedule = schedulingEngine(baseRec);
    expect(schedule.recommendedTime.getTime()).toBeGreaterThan(Date.now());
    const rollout = gradualRolloutEngine(baseRec, schedule);
    expect(rollout.phases).toHaveLength(3);
    expect(rollout.phases[0]?.percentageOfUsers).toBe(10);
  });

  it("action executor succeeds and recovery handles failure", () => {
    const schedule = schedulingEngine(baseRec);
    const rollout = gradualRolloutEngine(baseRec, schedule);
    const result = actionExecutorEngine(baseRec, rollout);
    expect(result.success).toBe(true);
    expect(result.actionId).toBeTruthy();

    const failed = actionExecutorEngine(
      { ...baseRec, description: "force fail" },
      rollout,
    );
    void failed;

    const recovery = errorRecoveryEngine(baseRec, { success: false, error: "timeout" });
    expect(recovery.strategy).toBe("rollback");
  });

  it("performance, workflow, resources, and compliance complete pipeline", () => {
    const schedule = schedulingEngine(baseRec);
    const rollout = gradualRolloutEngine(baseRec, schedule);
    const exec = actionExecutorEngine(baseRec, rollout)!;
    const optimized = performanceOptimizerEngine(exec);
    expect(optimized.cacheEnabled).toBe(true);
    const workflow = workflowOrchestratorEngine(baseRec, optimized);
    expect(workflow.completed).toBe(true);
    const allocation = resourceAllocatorEngine(baseRec, exec);
    expect(allocation.remaining).toBeGreaterThanOrEqual(0);
    const compliance = complianceEnforcerEngine(exec);
    expect(compliance.verified).toBe(true);
  });
});
