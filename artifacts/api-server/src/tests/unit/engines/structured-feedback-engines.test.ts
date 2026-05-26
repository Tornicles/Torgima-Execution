import { describe, it, expect } from "vitest";
import {
  computeAllEngineMetrics,
  runCompletionEngine,
  runOutputEngine,
  shouldShowReflectionSection,
} from "../../../engines/feedback/StructuredFeedbackEngines.js";

describe("StructuredFeedbackEngines", () => {
  it("completion engine matches spec example", () => {
    const rate = runCompletionEngine(
      [{ state: "Finished" }, { state: "Partly Done" }, { state: "Blocked" }],
      3,
    );
    expect(rate).toBeCloseTo(0.5, 2);
  });

  it("output engine sums created + learned weights", () => {
    const score = runOutputEngine(["created", "learned"]);
    expect(score).toBeCloseTo(0.3, 2);
  });

  it("full execution score stays hidden range 0-1", () => {
    const metrics = computeAllEngineMetrics({
      taskStates: [
        { state: "Finished" },
        { state: "Partly Done" },
        { state: "Blocked" },
      ],
      assignedCount: 3,
      outputs: ["created", "learned"],
      emotions: ["Focused", "Tired"],
      frictions: ["not_enough_time", "tool_tech_issue"],
      sectionsCompleted: 5,
    });
    expect(metrics.final_execution_score).toBeGreaterThanOrEqual(0);
    expect(metrics.final_execution_score).toBeLessThanOrEqual(1);
    expect(metrics.production_signal).toBeGreaterThan(0);
  });

  it("reflection section triggers on low completion", () => {
    expect(
      shouldShowReflectionSection({ completionRate: 0.4, recentLowDays: 0, momentum: 0 }),
    ).toBe(true);
    expect(
      shouldShowReflectionSection({ completionRate: 0.8, recentLowDays: 0, momentum: 0.1 }),
    ).toBe(false);
  });
});
