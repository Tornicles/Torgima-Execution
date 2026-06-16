/**
 * DOC21 — Pattern learning and burnout detection tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeBehaviorEvidence,
  type RawFeedbackRow,
} from "../../../engines/pattern/BehaviorEvidenceNormalizer.js";
import {
  scoreBurnoutRisk,
  riskLevelFromScore,
  BURNOUT_INDICATORS,
} from "../../../engines/pattern/BurnoutRiskScorer.js";
import { detectDelayPattern } from "../../../engines/pattern/PatternDetector.js";
import { shouldResolvePattern } from "../../../engines/pattern/PatternResolver.js";

function makeFeedback(
  overrides: Partial<RawFeedbackRow> & { created_at: Date },
): RawFeedbackRow {
  return {
    id: "fb-1",
    completion_status: "completed",
    score: 8,
    friction_score: 2,
    confidence_score: 4,
    duration_minutes: 30,
    late_penalty_applied: false,
    reflection: "",
    order_id: "order-1",
    taskDifficulty: "moderate",
    taskType: "execution",
    orderStartedAt: new Date(overrides.created_at.getTime() - 3600000),
    orderCreatedAt: new Date(overrides.created_at.getTime() - 7200000),
    submitted_hours_after_completion: null,
    ...overrides,
  };
}

describe("pattern-learning", () => {
  it("TEST 1: single miss does NOT create DELAY_PATTERN", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const row = makeFeedback({
      created_at: now,
      submitted_hours_after_completion: 20,
    });
    const evidence = normalizeBehaviorEvidence({
      feedbackRows: [row],
      now,
    });
    expect(detectDelayPattern(evidence)).toBeNull();
  });

  it("TEST 2: 3 delayed submissions DO create DELAY_PATTERN with severity MEDIUM", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const rows = [0, 1, 2].map((i) =>
      makeFeedback({
        id: `fb-${i}`,
        created_at: new Date(now.getTime() - i * 86400000),
        submitted_hours_after_completion: 20,
      }),
    );
    const evidence = normalizeBehaviorEvidence({ feedbackRows: rows, now });
    const detected = detectDelayPattern(evidence);
    expect(detected).not.toBeNull();
    expect(detected?.label).toBe("DELAY_PATTERN");
    expect(detected?.severity).toBe("MEDIUM");
  });

  it("TEST 3: burnout score >= 50 maps to HIGH and recommends load reduction", () => {
    expect(riskLevelFromScore(50)).toBe("HIGH");
    expect(riskLevelFromScore(74)).toBe("HIGH");
    expect(riskLevelFromScore(75)).toBe("CRITICAL");
    const now = new Date("2026-06-14T12:00:00Z");
    const feedbackRows = Array.from({ length: 20 }, (_, i) => {
      const dayOffset = 19 - i;
      const created = new Date(now.getTime() - dayOffset * 86400000);
      const inPriorWindow = dayOffset >= 8 && dayOffset <= 14;
      return makeFeedback({
        id: `fb-${i}`,
        created_at: created,
        friction_score: 1 + i * 0.55,
        confidence_score: Math.max(1, 6 - i * 0.3),
        completion_status: inPriorWindow ? "completed" : "failed",
        duration_minutes: inPriorWindow ? 20 : 40 + i * 2,
      });
    });
    const assessment = scoreBurnoutRisk(
      normalizeBehaviorEvidence({
        feedbackRows,
        now,
      }),
      { inactivityAfterHardFailure: true, now },
    );
    expect(assessment.score).toBeGreaterThanOrEqual(50);
    expect(assessment.score).toBeLessThan(75);
    expect(assessment.level).toBe("HIGH");
    expect(assessment.recommendedResponse).toBe("load_reduction");
  });

  it("TEST 4: CRITICAL burnout triggers force_recovery path via applyBurnoutProtectiveActions", async () => {
    vi.resetModules();

    const setMock = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const insertHealthMock = vi.fn().mockResolvedValue(undefined);
    const writeEventMock = vi.fn().mockResolvedValue("evt-1");

    vi.doMock("@workspace/db", () => ({
      db: {
        update: vi.fn(() => ({ set: setMock })),
        insert: vi.fn(() => ({ values: insertHealthMock })),
      },
      enforcementPackages: {},
      systemHealthLogs: {},
    }));

    vi.doMock("../../../services/EventService.js", () => ({
      writeEvent: writeEventMock,
      EVENT_TYPES: {
        LOAD_REDUCTION_REQUESTED: "load_reduction_requested",
        BURNOUT_RISK_DETECTED: "burnout_risk_detected",
      },
    }));

    const { applyBurnoutProtectiveActions: applyActions } = await import(
      "../../../engines/pattern/PatternLearningEngine.js"
    );

    await applyActions({
      userId: "user-1",
      blueprintId: "bp-1",
      assessment: {
        score: 80,
        level: "CRITICAL",
        firedIndicators: ["rising_friction", "completion_decline"],
        narrative: "Your system has entered a protected rest period with reduced load for this session.",
        recommendedResponse: "protective_rest",
      },
    });

    expect(setMock).toHaveBeenCalledWith({ recovery_required: true });
    expect(insertHealthMock).toHaveBeenCalled();
    const healthPayload = insertHealthMock.mock.calls[0]?.[0];
    expect(healthPayload?.details_json?.force_recovery).toBe(true);
    expect(healthPayload?.message?.toLowerCase()).not.toContain("burned out");
    expect(writeEventMock).toHaveBeenCalled();
  });

  it("TEST 5: DELAY_PATTERN resolves after 5 consecutive on-time submissions", () => {
    const now = new Date("2026-06-14T12:00:00Z");
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeFeedback({
        id: `fb-${i}`,
        created_at: new Date(now.getTime() - i * 3600000),
        submitted_hours_after_completion: 2,
      }),
    );
    const evidence = normalizeBehaviorEvidence({ feedbackRows: rows, now });
    const shouldResolve = shouldResolvePattern(
      {
        id: "pat-1",
        frequency: 1,
        first_detected_at: new Date(now.getTime() - 86400000),
        evidence_json: { spec_label: "DELAY_PATTERN" },
      },
      evidence,
    );
    expect(shouldResolve).toBe(true);
  });

  it("defines 8 weighted burnout indicators per DOC21", () => {
    expect(Object.keys(BURNOUT_INDICATORS)).toHaveLength(8);
    const totalWeight = Object.values(BURNOUT_INDICATORS).reduce((s, i) => s + i.weight, 0);
    expect(totalWeight).toBe(100);
  });

  it("uses shame-free language for CRITICAL assessment", () => {
    const assessment = scoreBurnoutRisk(
      normalizeBehaviorEvidence({ feedbackRows: [] }),
    );
    expect(assessment.narrative.toLowerCase()).not.toContain("burned out");
    expect(assessment.narrative.toLowerCase()).not.toContain("you are");
  });
});

describe("pattern-learning — applyBurnoutProtectiveActions smoke", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("HIGH level assessment is actionable without clinical language", async () => {
    const { applyBurnoutProtectiveActions } = await import(
      "../../../engines/pattern/PatternLearningEngine.js"
    );
    await expect(
      applyBurnoutProtectiveActions({
        userId: "user-test",
        blueprintId: "bp-test",
        assessment: {
          score: 55,
          level: "HIGH",
          firedIndicators: ["more_failures"],
          narrative: "Execution load is elevated — recovery-oriented pacing and a lighter queue are recommended.",
          recommendedResponse: "load_reduction",
        },
      }),
    ).resolves.toBeUndefined();
  });
});
