/**
 * DOC24 — Priority and task value engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  selectHighestValueTask,
  TASK_VALUE_WEIGHTS,
  scoreTaskValue,
  scoreDimensions,
  dependencyUnlockOverrideApplies,
} from "../../../engines/priority/PriorityEngine.js";

describe("priority-engine", () => {
  const baseCtx = {
    condition: "stability",
    capability: { difficulty_recommendation: "easy" },
    falseProgressActive: false,
    blueprintId: "bp-1",
    userId: "u-1",
    allowedActions: ["task_execution"],
    activeTargetId: "target-1",
  };

  it("weights sum to 1 for 6-dimension composite", () => {
    const sum = Object.values(TASK_VALUE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("TEST 1: outcome-aligned task wins over generic task", async () => {
    const aligned = {
      id: "aligned",
      task_type: "execution",
      linked_target_id: "target-1",
      target_validated: false,
      difficulty: "easy",
    };
    const generic = {
      id: "generic",
      task_type: "execution",
      difficulty: "easy",
    };

    const alignedDims = scoreDimensions(aligned, baseCtx);
    const genericDims = scoreDimensions(generic, baseCtx);
    expect(alignedDims.outcome_alignment).toBeGreaterThan(genericDims.outcome_alignment);
    expect(scoreTaskValue(aligned, baseCtx)).toBeGreaterThan(scoreTaskValue(generic, baseCtx));

    const result = await selectHighestValueTask([aligned, generic], baseCtx);
    expect(result.selectedTask?.id).toBe("aligned");
    expect(result.reason).toBe("value_score");
    expect(result.score).toBeGreaterThan(0);
  });

  it("TEST 2: recovery override bypasses scoring", async () => {
    const recovery = { id: "recovery-1", task_type: "recovery", difficulty: "very_easy" };
    const execution = {
      id: "exec-1",
      task_type: "execution",
      linked_target_id: "target-1",
      target_validated: false,
      is_next_blueprint_action: true,
      difficulty: "easy",
    };

    expect(scoreTaskValue(execution, baseCtx)).toBeGreaterThan(scoreTaskValue(recovery, baseCtx));

    const result = await selectHighestValueTask([recovery, execution], {
      ...baseCtx,
      forceRecovery: true,
    });
    expect(result.selectedTask?.task_type).toBe("recovery");
    expect(result.reason).toBe("override_rule");
    expect(result.overrideRule).toBe("RECOVERY_OVERRIDE");
    expect(result.score).toBe(100);
  });

  it("TEST 3: dependency unlock task wins when blocking others", async () => {
    const unlockTask = {
      id: "unlock-a",
      task_type: "execution",
      dependency_unlock_score: 100,
      blocks_other_tasks: 3,
      difficulty: "easy",
    };
    const outcomeTask = {
      id: "outcome-b",
      task_type: "execution",
      linked_target_id: "target-1",
      target_validated: false,
      is_next_blueprint_action: true,
      difficulty: "easy",
    };

    expect(dependencyUnlockOverrideApplies(unlockTask)).toBe(true);
    expect(scoreTaskValue(outcomeTask, baseCtx)).toBeGreaterThan(scoreTaskValue(unlockTask, baseCtx));

    const result = await selectHighestValueTask([unlockTask, outcomeTask], baseCtx);
    expect(result.selectedTask?.id).toBe("unlock-a");
    expect(result.reason).toBe("override_rule");
    expect(result.overrideRule).toBe("DEPENDENCY_OVERRIDE");
  });

  it("TEST 4: single candidate returns immediately without scoring", async () => {
    const only = { id: "solo", task_type: "execution", difficulty: "easy" };
    const result = await selectHighestValueTask([only], baseCtx);
    expect(result.selectedTask?.id).toBe("solo");
    expect(result.score).toBe(0);
    expect(result.reason).toBe("single_candidate");
  });
});
