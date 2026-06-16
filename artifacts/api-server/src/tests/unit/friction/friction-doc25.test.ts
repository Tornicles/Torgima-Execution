/**
 * DOC25 — Friction detection and adaptation tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { FrictionClassifier } from "../../../engines/friction/FrictionClassifier.js";
import {
  ADAPTATION_MATRIX,
  resolveAdaptationEvent,
  routeAdaptation,
  shouldTriggerRootCauseReview,
  adaptationIncreasesDifficulty,
  isUserCorrectionTaskEvent,
} from "../../../engines/friction/AdaptationRouter.js";
import { buildFrictionEvidenceFromParts } from "../../../engines/friction/FrictionEvidence.js";
import { DOC25_FRICTION_TYPES, FRICTION_TYPES } from "../../../engines/friction/frictionTypes.js";
import { EventTypes } from "../../../types/eventContracts.js";

const { writeEventMock } = vi.hoisted(() => ({
  writeEventMock: vi.fn().mockResolvedValue("evt-friction"),
}));

vi.mock("../../../services/EventService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/EventService.js")>();
  return {
    ...actual,
    writeEvent: writeEventMock,
  };
});

describe("friction-detection", () => {
  beforeEach(() => {
    writeEventMock.mockClear();
  });

  it("defines all 9 DOC25 friction types", () => {
    expect(DOC25_FRICTION_TYPES).toHaveLength(9);
    expect(FRICTION_TYPES).toContain("TIME_FRICTION");
    expect(FRICTION_TYPES).toContain("MOTIVATION_FRICTION");
  });

  it("TEST 1: CLARITY_FRICTION detected and clarification requested", async () => {
    const evidence = buildFrictionEvidenceFromParts({
      userId: "user-1",
      blueprintId: "bp-1",
      feedbackId: "fb-1",
      reflection: "I was confused about what to deliver",
      completionStatus: "FAILED",
      score: 3,
    });

    const detected = FrictionClassifier.classify(evidence);
    expect(detected.some((d) => d.type === "CLARITY_FRICTION")).toBe(true);

    const resolved = resolveAdaptationEvent({
      frictionType: "CLARITY_FRICTION",
      severity: "HIGH",
    });
    expect(resolved.event).toBe("clarification_task_requested");
    expect(ADAPTATION_MATRIX.CLARITY_FRICTION.target).toBe("TaskGenerationEngine");

    const result = await routeAdaptation({
      frictionType: "CLARITY_FRICTION",
      severity: "HIGH",
      context: { userId: "user-1", blueprintId: "bp-1", feedbackId: "fb-1" },
      reason: evidence.reflection,
    });

    expect(result.adaptationEvent).toBe("clarification_task_requested");
    expect(writeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EventTypes.CLARIFICATION_TASK_REQUESTED,
      }),
    );
  });

  it("TEST 2: SYSTEM_FRICTION routes to repair not correction task", async () => {
    const evidence = buildFrictionEvidenceFromParts({
      userId: "user-1",
      blueprintId: "bp-1",
      reflection: "the app error stopped me from submitting",
      stateIntegrityIssueRecent: true,
      reflectionMentionsSystem: true,
    });

    const detected = FrictionClassifier.classify(evidence);
    expect(detected[0]?.type).toBe("SYSTEM_FRICTION");

    const resolved = resolveAdaptationEvent({
      frictionType: "SYSTEM_FRICTION",
      severity: "HIGH",
    });
    expect(resolved.event).toBe("system_repair_requested");
    expect(resolved.target).toBe("StateIntegrityEngine");
    expect(isUserCorrectionTaskEvent("correction_task_requested")).toBe(true);
    expect(isUserCorrectionTaskEvent(resolved.event)).toBe(false);

    const result = await routeAdaptation({
      frictionType: "SYSTEM_FRICTION",
      severity: "HIGH",
      context: { userId: "user-1", blueprintId: "bp-1", feedbackId: "fb-2" },
    });

    expect(result.adaptationEvent).toBe("system_repair_requested");
    expect(writeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: EventTypes.SYSTEM_HEALTH_DEGRADED,
      }),
    );
    expect(
      writeEventMock.mock.calls.some(
        (call) => call[0]?.eventType === EventTypes.CORRECTION_TASK_REQUESTED,
      ),
    ).toBe(false);
  });

  it("TEST 3: DIFFICULTY_FRICTION does NOT increase difficulty", () => {
    const evidence = buildFrictionEvidenceFromParts({
      userId: "user-1",
      blueprintId: "bp-1",
      difficulty: "hard",
      score: 2,
      capabilityFailureClassified: false,
    });

    const detected = FrictionClassifier.classify(evidence);
    expect(detected.some((d) => d.type === "DIFFICULTY_FRICTION")).toBe(true);

    const resolved = resolveAdaptationEvent({
      frictionType: "DIFFICULTY_FRICTION",
      severity: "HIGH",
    });
    expect(resolved.event).toBe("difficulty_downgrade_requested");
    expect(resolved.event).not.toContain("upgrade");
    expect(adaptationIncreasesDifficulty("difficulty_downgrade_requested")).toBe(false);
    expect(adaptationIncreasesDifficulty("difficulty_upgrade_requested")).toBe(true);
  });

  it("TEST 4: 3 adaptation cycles without improvement triggers root cause review", () => {
    expect(
      shouldTriggerRootCauseReview("TIMING_FRICTION", { TIMING_FRICTION: 3 }),
    ).toBe(true);

    const resolved = resolveAdaptationEvent({
      frictionType: "TIMING_FRICTION",
      severity: "MEDIUM",
      adaptationCycleCount: { TIMING_FRICTION: 3 },
    });

    expect(resolved.rootCauseReview).toBe(true);
    expect(resolved.event).toBe("root_cause_review_requested");
    expect(resolved.event).not.toBe("timing_adaptation_requested");
  });
});
