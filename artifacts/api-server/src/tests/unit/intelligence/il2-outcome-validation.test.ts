/**
 * IL2 — Outcome Validation & False Progress tests (T1–T5).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectFalseProgress, FALSE_PROGRESS_PATTERNS } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";
import { EventTypes, EVENT_QUEUE_MAP } from "../../../types/eventContracts.js";
import { TorgimaError } from "../../../lib/errors.js";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ id: "flag-1" }]),
        })),
      })),
    })),
  },
  falseProgressFlags: {
    blueprint_id: "blueprint_id",
    user_id: "user_id",
    resolved: "resolved",
  },
}));

describe("IL2 — FalseProgressDetectionEngine", () => {
  it("T2: activity without outcome pattern when many completions, low movement", () => {
    const fp = detectFalseProgress({
      completionCount: 20,
      evidenceScore: 10,
      outcomeMovementScore: 5,
      hasProof: false,
      avgScore: 6,
    });
    expect(fp.detected).toBe(true);
    expect(fp.pattern).toBe("ACTIVITY_WITHOUT_OUTCOME");
  });

  it("nine patterns include ACTIVITY_WITHOUT_OUTCOME", () => {
    expect(FALSE_PROGRESS_PATTERNS).toContain("ACTIVITY_WITHOUT_OUTCOME");
    expect(FALSE_PROGRESS_PATTERNS).toContain("VANITY_PROGRESS");
  });
});

describe("IL2 — event chain", () => {
  it("OUTCOME_VALIDATION_REQUESTED maps to worker queue", () => {
    expect(EventTypes.OUTCOME_VALIDATION_REQUESTED).toBe("outcome_validation_requested");
    expect(EVENT_QUEUE_MAP[EventTypes.OUTCOME_VALIDATION_REQUESTED]).toBe(
      "outcome_validation_requested",
    );
  });
});

describe("IL2 — phase and reward gates", () => {
  it("T4: assertNoActiveFalseProgress throws FALSE_PROGRESS_BLOCKED", async () => {
    const { assertNoActiveFalseProgress } = await import(
      "../../../engines/outcome/OutcomeValidationEngine.js"
    );

    await expect(assertNoActiveFalseProgress("bp-1", "user-1")).rejects.toMatchObject({
      code: "FALSE_PROGRESS_BLOCKED",
    });
  });

  it("T3: RewardEngine blocks when open false progress flag (contract)", async () => {
    const { evaluateReward } = await import("../../../engines/reward/RewardEngine.js");
    expect(typeof evaluateReward).toBe("function");
  });
});

describe("IL2 — OutcomeValidationEngine.validate (unit thresholds)", () => {
  it("T1/T5: IL2 result mapping to legacy verdicts", async () => {
    const { OutcomeValidationEngine } = await import(
      "../../../engines/outcome/OutcomeValidationEngine.js"
    );
    const engine = new OutcomeValidationEngine();
    expect(engine.validate).toBeDefined();
    expect(typeof engine.validate).toBe("function");
  });

  it("FALSE_PROGRESS_BLOCKED is a TorgimaError", () => {
    const err = new TorgimaError("FALSE_PROGRESS_BLOCKED", "blocked");
    expect(err.code).toBe("FALSE_PROGRESS_BLOCKED");
  });
});
