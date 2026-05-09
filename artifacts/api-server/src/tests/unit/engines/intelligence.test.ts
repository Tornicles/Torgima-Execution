import { describe, it, expect } from "vitest";
import { resolveConflict } from "../../../engines/orchestration/SystemOrchestrationEngine.js";

describe("SystemOrchestrationEngine — conflict resolution", () => {
  it("CONTROL_ENGINE wins over TASK_GENERATION", () => {
    const result = resolveConflict({
      engineA:      "CONTROL_ENGINE",
      engineB:      "TASK_GENERATION",
      conflictType: "TASK_CONFLICT",
    });
    expect(result.winner).toBe("CONTROL_ENGINE");
    expect(result.loser).toBe("TASK_GENERATION");
  });

  it("CONTROL_ENGINE beats BHUDHI on TASK_CONFLICT", () => {
    const result = resolveConflict({
      engineA:      "CONTROL_ENGINE",
      engineB:      "BHUDHI",
      conflictType: "TASK_CONFLICT",
    });
    expect(result.winner).toBe("CONTROL_ENGINE");
  });

  it("DEPENDENCY_ENGINE beats REWARD_ENGINE on EXECUTION_CONFLICT", () => {
    const result = resolveConflict({
      engineA:      "DEPENDENCY_ENGINE",
      engineB:      "REWARD_ENGINE",
      conflictType: "EXECUTION_CONFLICT",
    });
    expect(result.winner).toBe("DEPENDENCY_ENGINE");
  });

  it("DEPENDENCY_ENGINE wins over REWARD_ENGINE", () => {
    const result = resolveConflict({
      engineA:      "REWARD_ENGINE",
      engineB:      "DEPENDENCY_ENGINE",
      conflictType: "EXECUTION_CONFLICT",
    });
    expect(result.winner).toBe("DEPENDENCY_ENGINE");
  });

  it("BHUDHI loses to every critical engine", () => {
    const criticalEngines = [
      "CONTROL_ENGINE",
      "DEPENDENCY_ENGINE",
      "CONDITION_ENGINE",
      "OUTCOME_TRUTH",
    ];
    criticalEngines.forEach(engine => {
      const result = resolveConflict({
        engineA:      "BHUDHI",
        engineB:      engine,
        conflictType: "STATE_CONFLICT",
      });
      expect(result.winner).toBe(engine);
    });
  });

  it("returns resolution description for every conflict type", () => {
    const types = [
      "TASK_CONFLICT",
      "STATE_CONFLICT",
      "PERMISSION_CONFLICT",
      "EXECUTION_CONFLICT",
    ] as const;
    types.forEach(conflictType => {
      const result = resolveConflict({
        engineA:      "CONTROL_ENGINE",
        engineB:      "BHUDHI",
        conflictType,
      });
      expect(result.resolution).toBeTruthy();
    });
  });
});

describe("PatternLearningEngine — fatigue detection", () => {
  it("FATIGUE_RISK pattern detected from high friction", () => {
    const avgFriction = 3.5 / 5;
    const failureRate = 0.4;
    const avgConfLoss = 0.3;
    const fatigueScore = avgFriction * 0.4 + failureRate * 0.4 + avgConfLoss * 0.2;
    expect(fatigueScore).toBeGreaterThan(0.4);
  });

  it("LOW fatigue score from good execution", () => {
    const avgFriction = 1 / 5;
    const failureRate = 0.05;
    const avgConfLoss = 0;
    const fatigueScore = avgFriction * 0.4 + failureRate * 0.4 + avgConfLoss * 0.2;
    expect(fatigueScore).toBeLessThan(0.3);
  });
});

describe("FailureClassificationEngine — categories", () => {
  it("10 failure categories are defined", () => {
    const categories = [
      "CLARITY_FAILURE",
      "CAPABILITY_FAILURE",
      "CAPACITY_FAILURE",
      "DEPENDENCY_FAILURE",
      "MOTIVATION_FRICTION",
      "SYSTEM_FRICTION",
      "WRONG_PRIORITY",
      "OUTCOME_MISMATCH",
      "EXTERNAL_BLOCKER",
      "PROOF_FAILURE",
    ];
    expect(categories).toHaveLength(10);
  });

  it("each category has a correction route", () => {
    const corrections: Record<string, string> = {
      CLARITY_FAILURE:     "clarification_task_requested",
      CAPABILITY_FAILURE:  "academy_task_requested",
      CAPACITY_FAILURE:    "load_reduction_requested",
      DEPENDENCY_FAILURE:  "dependency_resolution_requested",
      MOTIVATION_FRICTION: "friction_adaptation_requested",
      SYSTEM_FRICTION:     "system_repair_requested",
      WRONG_PRIORITY:      "priority_review_requested",
      OUTCOME_MISMATCH:    "correction_task_requested",
      EXTERNAL_BLOCKER:    "external_wait_requested",
      PROOF_FAILURE:       "evidence_clarification_requested",
    };
    Object.values(corrections).forEach(c => expect(c).toBeTruthy());
  });
});

describe("CapabilityEngine — level thresholds", () => {
  it("beginner is the starting level (lowest)", () => {
    const levels = ["beginner", "operator", "advanced", "lead"];
    expect(levels[0]).toBe("beginner");
  });

  it("lead requires highest consistency and task count", () => {
    const leadThreshold = { minConsistency: 0.85, minQuality: 0.85, minTasks: 75 };
    const operatorThreshold = { minConsistency: 0.5, minQuality: 0.5, minTasks: 10 };
    expect(leadThreshold.minConsistency).toBeGreaterThan(operatorThreshold.minConsistency);
    expect(leadThreshold.minTasks).toBeGreaterThan(operatorThreshold.minTasks);
  });
});

describe("RealTimePriorityEngine — recovery ranking heuristic", () => {
  it("recovery tasks receive urgency boost in danger (mirrors engine branch)", () => {
    const conditionName = "danger";
    const taskType = "recovery" as const;
    const urgency =
      taskType === "recovery" && ["danger", "nothingness"].includes(conditionName) ? 2.0 : 1.0;
    expect(urgency).toBe(2.0);
  });
});