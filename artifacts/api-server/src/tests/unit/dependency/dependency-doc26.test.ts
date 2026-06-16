/**
 * DOC26 — Dependency mapping and resolution tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateUnlockValue,
  DEPENDENCY_TYPES,
  resolutionTaskForDependencyType,
} from "../../../engines/dependency/dependencyResolution.js";
import { evaluateExecutabilityFromBlocks } from "../../../engines/dependency/ExecutabilityChecker.js";
import {
  generateResolutionTask,
  resolutionEventForDependency,
  RESOLUTION_TASK_TYPE_MAP,
} from "../../../engines/dependency/DependencyResolver.js";
import { EventTypes } from "../../../types/eventContracts.js";

const { writeEventMock } = vi.hoisted(() => ({
  writeEventMock: vi.fn().mockResolvedValue("evt-1"),
}));

vi.mock("../../../services/EventService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/EventService.js")>();
  return {
    ...actual,
    writeEvent: writeEventMock,
  };
});

describe("dependency", () => {
  beforeEach(() => {
    writeEventMock.mockClear();
  });

  it("dependency type catalog has 9 types", () => {
    expect(DEPENDENCY_TYPES).toHaveLength(9);
    expect(DEPENDENCY_TYPES).toContain("SEQUENCE");
    expect(DEPENDENCY_TYPES).toContain("OUTCOME_PROOF");
  });

  it("TEST 1: SEQUENCE dependency blocks task publication and emits resolution event", async () => {
    const result = evaluateExecutabilityFromBlocks([
      {
        type: "SEQUENCE",
        dependencyId: "dep-1",
        description: "Action requires prerequisite action to be complete first",
        resolutionStrategy: "complete_prerequisite_task",
      },
    ]);

    expect(result.executable).toBe(false);
    expect(result.blockingDependencies.some((dep) => dep.type === "SEQUENCE")).toBe(true);
    expect(resolutionEventForDependency("SEQUENCE")).toBe("dependency_resolution_task_requested");

    const routed = await generateResolutionTask({
      dependency: result.blockingDependencies[0]!,
      context: {
        blueprintId: "bp-1",
        userId: "user-1",
        candidateTaskId: "order-1",
      },
    });

    expect(routed.eventName).toBe("dependency_resolution_task_requested");
    expect(routed.eventType).toBe(EventTypes.DEPENDENCY_RESOLUTION_TASK_REQUESTED);
    expect(writeEventMock).toHaveBeenCalled();
  });

  it("TEST 2: CAPABILITY dependency routes to academy capability gap event", async () => {
    expect(resolutionEventForDependency("CAPABILITY")).toBe("erector_capability_gap_detected");
    expect(RESOLUTION_TASK_TYPE_MAP.CAPABILITY).toBe("academy");

    const spec = resolutionTaskForDependencyType("CAPABILITY", {});
    expect(spec.task_type).toBe("academy");
    expect(spec.instruction.length).toBeGreaterThan(10);
  });

  it("TEST 3: unlock value scales with blocked task count", () => {
    const blocks = [
      { type: "SEQUENCE" as const },
      { type: "DECISION" as const },
      { type: "INFORMATION" as const },
    ];
    const unlock = calculateUnlockValue(blocks, { blockedTaskCount: 3 });
    expect(unlock).toBeGreaterThanOrEqual(60);
    expect(unlock).toBeLessThanOrEqual(100);
  });

  it("TEST 4: no dependencies means executable", () => {
    const result = evaluateExecutabilityFromBlocks([]);
    expect(result.executable).toBe(true);
    expect(result.blockingDependencies).toHaveLength(0);
    expect(result.unlock_value).toBe(0);
    expect(result.recommendedNextAction).toBe("PUBLISH_TASK");
  });
});
