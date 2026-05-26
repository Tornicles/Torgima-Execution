import { describe, expect, it } from "vitest";
import {
  computeAdditionalTasksToGenerate,
  parseTaskLimits,
} from "../../../engines/task-generation/taskLimits.js";

describe("taskLimits", () => {
  it("parses nested taskLimit shape from blueprint launch", () => {
    expect(parseTaskLimits({ taskLimit: { min: 1, max: 2 } })).toEqual({ min: 1, max: 2 });
  });

  it("parses flat min/max shape from control engine", () => {
    expect(parseTaskLimits({ min: 3, max: 5 })).toEqual({ min: 3, max: 5 });
  });

  it("fills queue on initial launch until max", () => {
    expect(
      computeAdditionalTasksToGenerate({
        pendingCount: 1,
        min: 3,
        max: 5,
        generationMode: "initial",
        generationTrigger: "blueprint_launched",
        generatedThisInvocation: 1,
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
      }),
    ).toBe(1);
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
      }),
    ).toBe(0);
  });
});
