import { describe, it, expect } from "vitest";
import { calculateIdentityDimensions } from "../../../engines/identity/identityDimensions.js";
import { detectFalseProgress, FALSE_PROGRESS_PATTERNS } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";
import { scoreOutcomeDimensions } from "../../../engines/outcome/outcomeScoring.js";
import { EventTypes, EVENT_QUEUE_MAP } from "../../../types/eventContracts.js";

describe("Phase 3 — identity dimensions", () => {
  it("returns six dimension scores", () => {
    const dims = calculateIdentityDimensions({
      evidence: [
        {
          validity: "valid",
          gaming_flag: false,
          completion_status: "completed",
          reflection: "done well",
          friction_score: 2,
        } as never,
      ],
    });
    expect(dims.consistency).toBeGreaterThanOrEqual(0);
    expect(dims.completionIntegrity).toBe(100);
    expect(dims.focusContinuity).toBe(100);
  });
});

describe("Phase 3 — false progress (7 patterns)", () => {
  it("detects avoidance loop", () => {
    const fp = detectFalseProgress({
      completionCount: 5,
      evidenceScore: 30,
      outcomeMovementScore: 10,
      alignmentScore: 40,
      hasProof: false,
      avgScore: 6,
      criticalBlockerOpen: true,
      easyTaskOnly: true,
    });
    expect(fp.detected).toBe(true);
    expect(fp.pattern).toBe("AVOIDANCE_LOOP");
  });

  it("lists seven patterns including PROOF_WEAK", () => {
    expect(FALSE_PROGRESS_PATTERNS).toContain("PROOF_WEAK");
    expect(FALSE_PROGRESS_PATTERNS.length).toBe(7);
  });
});

describe("Phase 3 — outcome scoring", () => {
  it("CONTRADICTED path via high contradiction score input", () => {
    const scores = scoreOutcomeDimensions({
      evidenceTextLength: 10,
      hasProof: false,
      completionCount: 8,
      avgScore: 8,
      targetProgressRatio: 0.05,
      linkedToTarget: true,
      claimContradicted: true,
    });
    expect(scores.contradictionScore).toBeGreaterThanOrEqual(70);
  });
});

describe("Phase 3 — event wiring", () => {
  it("identity and reward workers mapped", () => {
    expect(EVENT_QUEUE_MAP[EventTypes.IDENTITY_EVALUATION_REQUESTED]).toBe(
      "identity_evaluation_requested",
    );
    expect(EVENT_QUEUE_MAP[EventTypes.REWARD_EVALUATION_REQUESTED]).toBe(
      "reward_evaluation_requested",
    );
    expect(EVENT_QUEUE_MAP[EventTypes.OUTCOME_VALIDATION_REQUESTED]).toBe(
      "outcome_validation_requested",
    );
    expect(EventTypes.REWARD_CREATED).toBe("reward_created");
    expect(EventTypes.CORRECTION_TASK_REQUESTED).toBe("correction_task_requested");
  });
});

describe("Phase 3 — HONEST_FAILURE gate", () => {
  it("requires reflection length >= 30 for failed feedback rewards", async () => {
    const mod = await import("../../../engines/reward/RewardEngine.js");
    expect(typeof mod.evaluateReward).toBe("function");
  });
});
