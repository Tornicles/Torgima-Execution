import { describe, it, expect } from "vitest";
import {
  INVESTIGATION_ENGINE_NAMES,
  subjectForEngine,
} from "../../../bhudhi/investigation/types.js";
import {
  detectAnomalies,
  findRecurringPatterns,
  findCorrelations,
  calculateGaps,
  mineHiddenInsights,
} from "../../../bhudhi/investigation/investigationData.js";
import { INVESTIGATION_ENGINE_RUNNERS } from "../../../bhudhi/investigation/engines.js";
import { BHUDHI_ENGINES } from "@workspace/db/bhudhi-seed-data";

describe("BHUDHI PROMPT 2 — Investigation System", () => {
  it("seed defines 13 investigation engines with Prompt 2 names", () => {
    const inv = BHUDHI_ENGINES.filter((e) => e.systemId === "investigation");
    expect(inv).toHaveLength(13);
    for (const name of INVESTIGATION_ENGINE_NAMES) {
      expect(inv.some((e) => e.name === name)).toBe(true);
    }
  });

  it("has a runner for each of the 13 engines", () => {
    expect(Object.keys(INVESTIGATION_ENGINE_RUNNERS)).toHaveLength(13);
    for (const name of INVESTIGATION_ENGINE_NAMES) {
      expect(INVESTIGATION_ENGINE_RUNNERS[name]).toBeTypeOf("function");
    }
  });

  it("maps engine names to investigation subjects", () => {
    expect(subjectForEngine("Data Collection Engine")).toBe("execution");
    expect(subjectForEngine("Pattern Discovery Engine")).toBe("patterns");
    expect(subjectForEngine("Anomaly Detection Engine")).toBe("anomalies");
    expect(subjectForEngine("Vulnerability Assessment Engine")).toBe("risks");
    expect(subjectForEngine("Hidden Insight Engine")).toBe("opportunities");
  });

  it("detectAnomalies flags low feedback and gaming", () => {
    const anomalies = detectAnomalies({
      taskCount: 10,
      completedCount: 5,
      activeCount: 2,
      blockedCount: 1,
      feedbackCount: 2,
      tasksPerDay: 2,
      feedbackRate: 0.2,
      dataPoints: 12,
      avgFriction: 0.5,
      avgCompletionHours: 0,
      gamingFlags: 3,
    });
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.severity === "high")).toBe(true);
  });

  it("findRecurringPatterns groups event types", () => {
    const patterns = findRecurringPatterns([
      { id: "1", eventType: "task_completed", description: "a", createdAt: new Date() },
      { id: "2", eventType: "task_completed", description: "b", createdAt: new Date() },
      { id: "3", eventType: "signal_updated", description: "c", createdAt: new Date() },
    ]);
    expect(patterns).toContainEqual({ name: "task_completed", frequency: 2 });
  });

  it("calculateGaps identifies below-benchmark metrics", () => {
    const gaps = calculateGaps(
      { completionRate: 0.3, feedbackRate: 0.5, velocity: 2 },
      { completionRate: 0.6, feedbackRate: 0.9, velocity: 7 },
    );
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((g) => g.percentDiff > 0)).toBe(true);
  });

  it("mineHiddenInsights surfaces silent completion", () => {
    const insights = mineHiddenInsights({
      taskCount: 5,
      completedCount: 3,
      activeCount: 0,
      blockedCount: 0,
      feedbackCount: 0,
      tasksPerDay: 1,
      feedbackRate: 0,
      dataPoints: 5,
      avgFriction: 0,
      avgCompletionHours: 0,
      gamingFlags: 0,
    });
    expect(insights.some((i) => i.includes("Silent completion"))).toBe(true);
  });

  it("engine runners are async functions (DB-backed at runtime)", () => {
    for (const name of INVESTIGATION_ENGINE_NAMES) {
      const runner = INVESTIGATION_ENGINE_RUNNERS[name];
      expect(runner.constructor.name).toBe("AsyncFunction");
      expect(runner.length).toBe(1);
    }
  });
});
