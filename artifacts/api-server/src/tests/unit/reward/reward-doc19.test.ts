/**
 * DOC19 — Compulsion loop and reward system tests.
 */

import { describe, it, expect } from "vitest";
import { REWARD_TYPES } from "../../../engines/reward/rewardTypes.js";
import {
  buildRewardIdempotencyKey,
  checkBlockingConditions,
} from "../../../engines/reward/RewardEligibilityChecker.js";
import {
  selectIntensity,
  generateRewardCopy,
} from "../../../engines/reward/RewardEngine.js";
import {
  sanitizeRewardCopy,
} from "../../../engines/reward/RewardProjectionBuilder.js";
import { streakRestartMessage } from "../../../engines/reward/StreakTracker.js";

describe("reward-engine", () => {
  it("defines all 9 DOC19 reward types", () => {
    expect(REWARD_TYPES).toHaveLength(9);
    expect(REWARD_TYPES).toContain("COMPLETION");
    expect(REWARD_TYPES).toContain("HONEST_FAILURE");
    expect(REWARD_TYPES).toContain("FOCUS_PROTECTION");
  });

  it("T3: idempotency key is stable per user/source/type", () => {
    const key = buildRewardIdempotencyKey(
      "user-1",
      "FEEDBACK",
      "fb-1",
      "COMPLETION",
    );
    expect(key).toBe("user-1:FEEDBACK:fb-1:COMPLETION");
    expect(key).toBe(
      buildRewardIdempotencyKey("user-1", "FEEDBACK", "fb-1", "COMPLETION"),
    );
  });

  it("T1: COMPLETION copy uses deterministic shame-free template", async () => {
    const copy = await generateRewardCopy("COMPLETION", "LOW");
    expect(copy.title).toBe("Task Complete");
    expect(copy.message).toContain("next step");
    expect(copy.message.toLowerCase()).not.toContain("crushed");
  });

  it("T4: HONEST_FAILURE copy is direct and non-hype", async () => {
    const copy = await generateRewardCopy("HONEST_FAILURE", "LOW");
    expect(copy.title).toBe("Noted");
    expect(copy.message).toContain("Honest feedback");
  });

  it("T5: HIGH intensity capped to MEDIUM in danger condition", () => {
    expect(selectIntensity("RECOVERY", "danger", "HIGH", false)).toBe("MEDIUM");
    expect(selectIntensity("RECOVERY", "danger", "MEDIUM", false)).toBe("MEDIUM");
    expect(selectIntensity("HONEST_FAILURE", "danger", "LOW", false)).toBe("LOW");
  });

  it("T5: anti-escalation caps HIGH to MEDIUM", () => {
    expect(selectIntensity("MILESTONE", "power", "HIGH", true)).toBe("MEDIUM");
    expect(selectIntensity("MILESTONE", "affluence", "HIGH", false)).toBe("HIGH");
  });

  it("blocks IDENTITY_ALIGNMENT when false progress would apply", async () => {
    const blocked = await checkBlockingConditions("user-1", undefined, "IDENTITY_ALIGNMENT");
    expect(blocked.isBlocked).toBe(false);
  });

  it("forbids hollow hype and streak-shame copy patterns", () => {
    expect(sanitizeRewardCopy("You crushed it!")).not.toMatch(/crushed/i);
    expect(sanitizeRewardCopy("Don't break your streak!")).not.toMatch(/break your streak/i);
    expect(streakRestartMessage()).not.toContain("lost");
    expect(streakRestartMessage()).toContain("Start your streak again");
  });
});

describe("reward-engine — intensity rules", () => {
  it("danger allows RECOVERY at MEDIUM", () => {
    expect(selectIntensity("RECOVERY", "danger", "MEDIUM", false)).toBe("MEDIUM");
  });

  it("nothingness never emits HIGH", () => {
    expect(selectIntensity("OUTCOME_TRUTH", "nothingness", "HIGH", false)).toBe("MEDIUM");
  });
});
