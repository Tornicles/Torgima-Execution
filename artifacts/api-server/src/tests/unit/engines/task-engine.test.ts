import { describe, it, expect } from "vitest";
import {
  buildInstructionFromAction,
  buildSlotsFromCounts,
  dailyTaskTotalForCondition,
  generationModeForCondition,
  hiddenHorizonDays,
} from "../../../engines/task-engine/TaskEngine.js";
import {
  distributeDailyTaskCounts,
  DEFAULT_STARTER_ALLOCATION,
} from "../../../engines/mini-plan/MiniPlanAllocationEngine.js";

describe("TaskEngine", () => {
  it("hidden horizon matches tier spec ranges", () => {
    expect(hiddenHorizonDays("starter")).toBe(14);
    expect(hiddenHorizonDays("growth")).toBe(28);
    expect(hiddenHorizonDays("ultimate")).toBe(56);
  });

  it("allocates 9 starter tasks across mini plans", () => {
    const counts = distributeDailyTaskCounts(9, DEFAULT_STARTER_ALLOCATION);
    expect(counts.Foundation + counts.Operations + counts.Growth).toBe(9);
  });

  it("buildSlotsFromCounts respects per-mini counts", () => {
    const slots = buildSlotsFromCounts(2, { Foundation: 2, Operations: 1, Growth: 0 });
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.dayOffset === 2)).toBe(true);
    expect(slots.filter((s) => s.miniPlanKey === "Foundation")).toHaveLength(2);
  });

  it("buildSlotsFromCounts only generates needed tasks for partial day", () => {
    const need = 3;
    const counts = distributeDailyTaskCounts(need, DEFAULT_STARTER_ALLOCATION);
    const slots = buildSlotsFromCounts(1, counts);
    expect(slots.length).toBe(need);
  });

  it("uses recovery generation mode in danger", () => {
    expect(generationModeForCondition("danger", "initial")).toBe("recovery");
    expect(generationModeForCondition("stability", "daily")).toBe("daily");
  });

  it("builds instruction template fields per spec", () => {
    const t = buildInstructionFromAction({
      name: "Create login screen",
      description: "Blocks auth",
    });
    expect(t.instruction).toContain("Create login screen");
    expect(t.instruction.toLowerCase()).toContain("because");
    expect(t.expected_output.toLowerCase()).toContain("artifact");
    expect(t.definition_of_done.toLowerCase()).toContain("complete");
  });

  it("stability daily total is 9, danger is 3", () => {
    expect(dailyTaskTotalForCondition("stability")).toBe(9);
    expect(dailyTaskTotalForCondition("danger")).toBe(3);
  });
});
