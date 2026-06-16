/**
 * DOC22 — Failure classification and root cause tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FailureEvidence } from "../../../engines/failure/FailureEvidence.js";
import {
  scoreAll,
  confidenceFromReflection,
  baseSeverityFromScore,
  escalateSeverityLevel,
} from "../../../engines/failure/RootCauseScorer.js";
import { CORRECTION_ROUTES, correctionTypeToTaskType } from "../../../engines/failure/CorrectionRouter.js";
import { FAILURE_CATEGORIES } from "../../../engines/failure/failureTypes.js";

function baseEvidence(overrides: Partial<FailureEvidence> = {}): FailureEvidence {
  return {
    userId: "user-1",
    blueprintId: "bp-1",
    orderId: "order-1",
    feedbackId: "fb-1",
    feedbackReflectionLength: 40,
    reflection: "",
    completionStatus: "failed",
    score: 3,
    frictionScore: 2,
    confidenceScore: 3,
    durationMinutes: 30,
    gamingFlag: false,
    proofJson: null,
    validationStatus: null,
    rejectionReason: null,
    blockerJson: null,
    blockerCategory: undefined,
    orderDifficulty: "moderate",
    orderTaskType: "execution",
    proofRequired: false,
    proofDescription: "Submit proof of completion",
    orderActionId: null,
    orderRegenerationCount: 0,
    conditionName: "power",
    consistency7d: 55,
    difficultyHandling: "intermediate",
    hardFailures14d: 0,
    activePatternTypes: [],
    activeSpecLabels: [],
    falseProgressScore: 0,
    falseProgressFlagType: undefined,
    outcomeMovementScore: 50,
    fatigueRiskPatternActive: false,
    taskTypeAvoidanceActive: false,
    stateIntegrityIssueRecent: false,
    summary: "failed on moderate execution",
    ...overrides,
  };
}

describe("failure-classification", () => {
  it("TEST 1: CLARITY_FAILURE on unclear task routes to clarification", () => {
    const evidence = baseEvidence({
      reflection: "task was confusing, didnt know what to do",
      feedbackReflectionLength: 42,
    });
    const scores = scoreAll(evidence);
    expect(scores[0]?.category).toBe("CLARITY_FAILURE");
    expect(CORRECTION_ROUTES.CLARITY_FAILURE.correctionType).toBe("clarification_task_requested");
    expect(correctionTypeToTaskType(CORRECTION_ROUTES.CLARITY_FAILURE.correctionType)).toBe(
      "clarification",
    );
  });

  it("TEST 2: repeated hard task failures score CAPABILITY_FAILURE highly", () => {
    const evidence = baseEvidence({
      orderDifficulty: "hard",
      difficultyHandling: "beginner",
      hardFailures14d: 3,
      completionStatus: "failed",
    });
    const scores = scoreAll(evidence);
    expect(scores[0]?.category).toBe("CAPABILITY_FAILURE");
    expect(scores[0]?.score).toBeGreaterThanOrEqual(60);
    let severity = baseSeverityFromScore(scores[0]!.score);
    severity = escalateSeverityLevel(severity);
    expect(severity).toBe("CRITICAL");
  });

  it("TEST 3: SYSTEM_FRICTION when integrity check failed recently", () => {
    const evidence = baseEvidence({
      stateIntegrityIssueRecent: true,
      reflection: "the app threw an error when I tried to submit",
    });
    const scores = scoreAll(evidence);
    expect(scores[0]?.category).toBe("SYSTEM_FRICTION");
    expect(CORRECTION_ROUTES.SYSTEM_FRICTION.correctionType).toBe("system_repair_requested");
  });

  it("TEST 4: low evidence yields LOW confidence and LOW severity", () => {
    const evidence = baseEvidence({
      reflection: "n/a",
      feedbackReflectionLength: 3,
      completionStatus: "failed",
      score: 4,
    });
    const scores = scoreAll(evidence);
    const confidence = confidenceFromReflection(evidence.feedbackReflectionLength);
    const severity = baseSeverityFromScore(scores[0]?.score ?? 20);
    expect(confidence).toBe("LOW");
    expect(severity).toBe("LOW");
    expect(CORRECTION_ROUTES.CLARITY_FAILURE.minSeverity).toBe("MEDIUM");
  });

  it("scores all 10 DOC22 failure categories", () => {
    expect(FAILURE_CATEGORIES).toHaveLength(10);
    for (const category of FAILURE_CATEGORIES) {
      expect(CORRECTION_ROUTES[category].correctionType).toBeTruthy();
      expect(CORRECTION_ROUTES[category].targetEngine).toBeTruthy();
    }
  });

  it("secondary categories require score >= 30", () => {
    const evidence = baseEvidence({
      reflection: "waiting on client approval and the task was confusing",
      blockerCategory: "EXTERNAL_WAIT",
      completionStatus: "blocked",
      proofRequired: true,
      proofDescription: null,
    });
    const scores = scoreAll(evidence);
    const secondaries = scores.slice(1, 3).filter((s) => s.score >= 30).map((s) => s.category);
    expect(scores.length).toBeGreaterThan(1);
    expect(secondaries.every((c) => FAILURE_CATEGORIES.includes(c))).toBe(true);
  });
});

describe("failure-classification — routeCorrection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("does not route correction when severity is LOW", async () => {
    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: vi.fn().mockResolvedValue("evt-1"),
      EVENT_TYPES: {
        CLARIFICATION_TASK_REQUESTED: "clarification_task_requested",
        SYSTEM_HEALTH_DEGRADED: "system_health_degraded",
        TASK_GENERATION_REQUESTED: "task_generation_requested",
      },
    }));

    const { routeCorrection } = await import("../../../engines/failure/CorrectionRouter.js");
    const { writeEvent } = await import("../../../services/EventService.js");

    const result = await routeCorrection({
      primaryCategory: "CLARITY_FAILURE",
      userId: "user-1",
      blueprintId: "bp-1",
      orderId: "order-1",
      feedbackId: "fb-1",
      severity: "LOW",
      repeat: {
        repeatFailure: false,
        sameCategoryCount7d: 0,
        sameOrderFailureCount: 0,
        proofRejectedCount: 0,
        forceClarityForSameOrder: false,
        escalateConfidence: false,
        escalateSeverity: false,
        proofUxReviewRequired: false,
      },
    });

    expect(result.routed).toBe(false);
    expect(writeEvent).not.toHaveBeenCalled();
  });

  it("routes SYSTEM_FRICTION at MEDIUM severity", async () => {
    const writeEventMock = vi.fn().mockResolvedValue("evt-1");
    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: writeEventMock,
      EVENT_TYPES: {
        SYSTEM_HEALTH_DEGRADED: "system_health_degraded",
        TASK_GENERATION_REQUESTED: "task_generation_requested",
      },
    }));

    const { routeCorrection } = await import("../../../engines/failure/CorrectionRouter.js");

    const result = await routeCorrection({
      primaryCategory: "SYSTEM_FRICTION",
      userId: "user-1",
      blueprintId: "bp-1",
      orderId: "order-1",
      feedbackId: "fb-1",
      severity: "MEDIUM",
      repeat: {
        repeatFailure: false,
        sameCategoryCount7d: 0,
        sameOrderFailureCount: 0,
        proofRejectedCount: 0,
        forceClarityForSameOrder: false,
        escalateConfidence: false,
        escalateSeverity: false,
        proofUxReviewRequired: false,
      },
    });

    expect(result.routed).toBe(true);
    expect(writeEventMock).toHaveBeenCalled();
  });
});
