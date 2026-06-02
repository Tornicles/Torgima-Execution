/**
 * Phase 5 — Decision trace, priority, friction window, dependency resolution.
 */

import { describe, it, expect } from "vitest";
import {
  PriorityEngine,
  scorePriorityCandidate,
} from "../../../engines/priority/PriorityEngine.js";
import {
  computeTaskValueScore,
  isRecoveryPriorityOverride,
  signalUrgencyForCondition,
  SIGNAL_URGENCY_WEIGHTS,
} from "../../../engines/priority/priorityScoring.js";
import { isTaskTypeAllowed } from "../../../engines/priority/priorityExclusions.js";
import { computeFrictionScore } from "../../../engines/friction/frictionWindowScoring.js";
import { computeEnforcementCognitiveLoadScore } from "../../../services/DecisionTraceService.js";
import {
  resolutionTaskForDependencyType,
  unlockValueForDependency,
  DEPENDENCY_TYPES,
} from "../../../engines/dependency/dependencyResolution.js";

describe("Phase 5 — PriorityEngine", () => {
  const engine = new PriorityEngine();

  it("excludes tasks outside allowed_actions", () => {
    const ranked = engine.rankCandidates(
      [{ task_type: "execution" }, { task_type: "blocker_resolution" }],
      {
        condition: "danger",
        capability: { difficulty_recommendation: "easy" },
        falseProgressActive: false,
        blueprintId: "bp-1",
        userId: "u-1",
        allowedActions: ["academy_tasks"],
      },
    );
    expect(ranked.allExcluded).toBe(true);
    expect(ranked.selected).toBeNull();
  });

  it("recovery override scores 100 in danger", () => {
    const ranked = engine.rankCandidates(
      [{ task_type: "recovery" }, { task_type: "execution" }],
      {
        condition: "danger",
        capability: null,
        falseProgressActive: false,
        blueprintId: "bp-1",
        userId: "u-1",
        allowedActions: ["task_execution", "academy_tasks"],
      },
    );
    expect(ranked.selected?.task_type).toBe("recovery");
    expect(ranked.scored.find((s) => s.candidate.task_type === "recovery")?.score).toBe(100);
  });

  it("dependency-blocked orders score 0", () => {
    const ranked = engine.rankCandidates(
      [
        { id: "blocked-1", task_type: "execution" },
        { id: "ok-1", task_type: "execution" },
      ],
      {
        condition: "stability",
        capability: null,
        falseProgressActive: false,
        blueprintId: "bp-1",
        userId: "u-1",
        allowedActions: ["task_execution"],
        dependencyBlockedOrderIds: new Set(["blocked-1"]),
      },
    );
    expect(ranked.selected?.id).toBe("ok-1");
    expect(
      ranked.scored.find((s) => s.candidate.id === "blocked-1")?.excluded,
    ).toBe(true);
  });

  it("preserves IL4 heuristic scorePriorityCandidate", () => {
    const ctx = {
      condition: "danger",
      capability: { difficulty_recommendation: "easy" as const },
      falseProgressActive: false,
    };
    expect(
      scorePriorityCandidate({ task_type: "blocker_resolution" }, ctx),
    ).toBeGreaterThan(scorePriorityCandidate({ task_type: "execution" }, ctx));
  });

  it("signal urgency weights match DOC 24", () => {
    expect(SIGNAL_URGENCY_WEIGHTS.danger).toBe(0.9);
    expect(signalUrgencyForCondition("stability")).toBe(0.5);
  });

  it("isRecoveryPriorityOverride for danger recovery", () => {
    expect(isRecoveryPriorityOverride({ task_type: "recovery" }, "danger")).toBe(true);
    expect(isRecoveryPriorityOverride({ task_type: "recovery" }, "stability")).toBe(false);
  });
});

describe("Phase 5 — friction window", () => {
  it("frictionScore > 1 when type failures dominate", () => {
    expect(computeFrictionScore(0.8, 0.2)).toBeGreaterThan(1);
  });

  it("TASK_TYPE friction threshold at 0.5", () => {
    expect(computeFrictionScore(0.6, 0.3)).toBeGreaterThan(0.5);
  });
});

describe("Phase 5 — DecisionTraceService cognitive load", () => {
  it("clamps enforcement cognitive load 0–100", () => {
    expect(computeEnforcementCognitiveLoadScore({ activeOrderCount: 2, taskMax: 3, difficultyCap: "hard" })).toBeLessThanOrEqual(100);
    expect(computeEnforcementCognitiveLoadScore({ activeOrderCount: 0, taskMax: 5, difficultyCap: "easy" })).toBe(0);
  });
});

describe("Phase 5 — dependency resolution", () => {
  it("CAPABILITY dependency generates academy task", () => {
    const spec = resolutionTaskForDependencyType("CAPABILITY", {});
    expect(spec.task_type).toBe("academy");
    expect(spec.instruction.length).toBeGreaterThan(10);
  });

  it("EXTERNAL_RESPONSE generates check-in task", () => {
    const spec = resolutionTaskForDependencyType("EXTERNAL_RESPONSE", {});
    expect(spec.title.toLowerCase()).toContain("follow");
    expect(spec.task_type).toBe("blocker_resolution");
  });

  it("unlock value higher for critical path", () => {
    const single = unlockValueForDependency("SEQUENCE", false, true);
    const multi = unlockValueForDependency("SEQUENCE", true, true);
    expect(multi).toBeGreaterThanOrEqual(single);
  });

  it("dependency type catalog has 9 types", () => {
    expect(DEPENDENCY_TYPES).toHaveLength(9);
  });
});

describe("Phase 5 — allowed action mapping", () => {
  it("execution requires task_execution", () => {
    expect(isTaskTypeAllowed("execution", ["task_execution"])).toBe(true);
    expect(isTaskTypeAllowed("execution", ["academy_tasks"])).toBe(false);
  });
});
