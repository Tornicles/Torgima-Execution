import { describe, it, expect } from "vitest";
import {
  computeSpecFatigueRiskScore,
  calculatePatternScores,
} from "../../../engines/pattern/patternScoring.js";
import { EventTypes, EVENT_QUEUE_MAP, WorkerQueues } from "../../../types/eventContracts.js";
import { correctionTypeToTaskType } from "../../../engines/failure/FailureClassificationEngine.js";

describe("Phase 4 — fatigue risk formula", () => {
  it("FATIGUE_RISK when riskScore >= 0.6", () => {
    const score = computeSpecFatigueRiskScore({
      prev7dCompletionRate: 0.8,
      curr3dCompletionRate: 0.2,
      recentTasks: [
        { effortScore: 5, notesLength: 5, durationMinutes: 2, timeEstimate: 60 },
        { effortScore: 5, notesLength: 8, durationMinutes: 1, timeEstimate: 45 },
      ],
      hardTasksLast3d: 4,
      inactivityAfterIntensity: true,
    });
    expect(score).toBeGreaterThanOrEqual(0.6);
  });
});

describe("Phase 4 — pattern scores", () => {
  it("returns five dimension scores", () => {
    const s = calculatePatternScores({
      occurrenceCount: 5,
      windowSize: 14,
      impactOnCompletion: 0.4,
      trendDelta: -0.2,
      crossTypeStability: 0.8,
    });
    expect(s.riskScore).toBeGreaterThan(0);
    expect(s.frequencyScore).toBeLessThanOrEqual(1);
  });
});

describe("Phase 4 — workers and events", () => {
  it("FailureWorker queue mapped", () => {
    expect(WorkerQueues.FAILURE_CLASSIFICATION).toBe("failure_classification_requested");
    expect(EVENT_QUEUE_MAP[EventTypes.FAILURE_CLASSIFICATION_REQUESTED]).toBe(
      WorkerQueues.FAILURE_CLASSIFICATION,
    );
  });

  it("Pattern daily cron queue exists", () => {
    expect(WorkerQueues.PATTERN_DAILY_CRON).toBe("pattern-daily-scan");
  });

  it("CAPABILITY_FAILURE routes to academy task type", () => {
    expect(correctionTypeToTaskType("academy_task_requested")).toBe("academy");
  });

  it("ADAPTATION_REQUESTED event type defined", () => {
    expect(EventTypes.ADAPTATION_REQUESTED).toBe("adaptation_requested");
    expect(EventTypes.RECOVERY_PATTERN_LEARNED).toBe("recovery_pattern_learned");
  });
});
