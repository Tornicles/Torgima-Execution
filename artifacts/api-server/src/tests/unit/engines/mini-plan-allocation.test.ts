import { describe, it, expect } from "vitest";
import { dailyTasksForCondition } from "../../../constants/conditionSpec.js";
import {
  ALLOCATION_BY_CONDITION,
  buildQueueDayPattern,
  distributeDailyTaskCounts,
  getAllocationForCondition,
  getMiniPlanTaskFocus,
  mapPlanNameToMiniPlan,
} from "../../../engines/mini-plan/MiniPlanAllocationEngine.js";

describe("MiniPlanAllocationEngine", () => {
  it("starter default is F30 O30 G40", () => {
    const a = getAllocationForCondition("stability");
    expect(a).toEqual(ALLOCATION_BY_CONDITION.stability);
    expect(a.Foundation + a.Operations + a.Growth).toBe(100);
  });

  it("danger emphasizes foundation", () => {
    const a = getAllocationForCondition("danger");
    expect(a.Foundation).toBe(60);
    expect(a.Growth).toBe(10);
  });

  it("urgency emphasizes operations", () => {
    const a = getAllocationForCondition("urgency");
    expect(a.Operations).toBe(40);
  });

  it("power emphasizes growth", () => {
    const a = getAllocationForCondition("power");
    expect(a.Growth).toBe(50);
  });

  it("distributes 9 daily tasks per spec proportions", () => {
    const counts = distributeDailyTaskCounts(9, ALLOCATION_BY_CONDITION.stability);
    expect(counts.Foundation + counts.Operations + counts.Growth).toBe(9);
    expect(counts.Foundation).toBe(3);
    expect(counts.Operations).toBe(3);
    expect(counts.Growth).toBe(3);
  });

  it("maps legacy Validation plan to Operations", () => {
    expect(mapPlanNameToMiniPlan("Validation")).toBe("Operations");
  });

  it("builds queue day pattern F/O/G letters", () => {
    const pattern = buildQueueDayPattern({ Foundation: 3, Operations: 3, Growth: 3 });
    expect(pattern).toEqual(["F", "F", "F", "O", "O", "O", "G", "G", "G"]);
  });

  it("distributes danger allocation across daily cap", () => {
    const total = dailyTasksForCondition("danger");
    const counts = distributeDailyTaskCounts(total, ALLOCATION_BY_CONDITION.danger);
    expect(counts.Foundation + counts.Operations + counts.Growth).toBe(total);
    expect(counts.Foundation).toBeGreaterThan(counts.Growth);
  });

  it("distributes power allocation with growth emphasis", () => {
    const total = dailyTasksForCondition("power");
    const counts = distributeDailyTaskCounts(total, ALLOCATION_BY_CONDITION.power);
    expect(counts.Growth).toBeGreaterThan(counts.Foundation);
  });

  it("returns mini plan focus copy for danger foundation", () => {
    const focus = getMiniPlanTaskFocus("danger", "Foundation");
    expect(focus.toLowerCase()).toContain("blocker");
  });
});
