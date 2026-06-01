import { describe, expect, it } from "vitest";
import {
  computeAdditionalTasksToGenerate,
  computeDailyMidpoint,
  parseTaskLimits,
  selectTaskCount,
} from "../../../engines/task-generation/taskLimits.js";

describe("taskLimits", () => {
  it("parses nested taskLimit shape from blueprint launch", () => {
    expect(parseTaskLimits({ taskLimit: { min: 1, max: 2 } })).toEqual({ min: 1, max: 2 });
  });

  it("parses flat min/max shape from control engine", () => {
    expect(parseTaskLimits({ min: 3, max: 5 })).toEqual({ min: 3, max: 5 });
  });

  it("selectTaskCount initial caps at 3", () => {
    expect(
      selectTaskCount({
        task_limits: { min: 5, max: 7 },
        current_streak: 0,
        generation_mode: "initial",
      }),
    ).toBe(3);
  });

  it("selectTaskCount uses streak every 3 days toward max", () => {
    expect(
      selectTaskCount({
        task_limits: { min: 5, max: 7 },
        current_streak: 6,
        generation_mode: "post_feedback",
      }),
    ).toBe(7);
  });

  it("daily midpoint for stability is 6", () => {
    expect(computeDailyMidpoint({ min: 5, max: 7 })).toBe(6);
  });

  it("selectTaskCount daily returns midpoint", () => {
    expect(
      selectTaskCount({
        task_limits: { min: 5, max: 7 },
        current_streak: 15,
        generation_mode: "daily",
      }),
    ).toBe(6);
  });

  it("fills queue on initial launch to initial target", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 1,
        min: 3,
        max: 5,
        generationMode: "initial",
        generationTrigger: "blueprint_launched",
        generatedThisInvocation: 1,
      }),
    ).toBe(2);
  });

  it("daily mode tops up toward midpoint", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 2,
        min: 5,
        max: 7,
        generationMode: "daily",
        generationTrigger: "daily_cycle",
        generatedThisInvocation: 0,
      }),
    ).toBe(4);
  });

  it("fills to min on guarantee when below minimum", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 1,
        min: 3,
        max: 5,
        generationMode: "post_feedback",
        generationTrigger: "guarantee_worker",
        queueFill: true,
        generatedThisInvocation: 1,
        currentStreak: 0,
      }),
    ).toBe(2);
  });

  it("still fills toward min after feedback when queue is below minimum", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 2,
        min: 3,
        max: 5,
        generationMode: "post_feedback",
        generationTrigger: "feedback_submitted",
        generatedThisInvocation: 1,
        currentStreak: 0,
      }),
    ).toBe(2);
  });

  it("stops after one task when already at minimum queue depth", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 3,
        min: 3,
        max: 5,
        generationMode: "post_feedback",
        generationTrigger: "feedback_submitted",
        generatedThisInvocation: 1,
        currentStreak: 0,
      }),
    ).toBe(0);
  });
});
