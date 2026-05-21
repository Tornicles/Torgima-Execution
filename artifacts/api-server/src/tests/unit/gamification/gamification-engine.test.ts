import { describe, it, expect } from "vitest";
import {
  calculateLevelFromXp,
  calculateXPForEvent,
  streakMultiplier,
  xpProgressForLevel,
  getStreakTypeForEvent,
} from "../../../engines/gamification/GamificationEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("Level curve", () => {
  it("starts at level 1 with 0 XP", () => {
    expect(calculateLevelFromXp(0)).toBe(1);
  });

  it("levels up after cumulative thresholds", () => {
    expect(calculateLevelFromXp(100)).toBe(2);
    expect(calculateLevelFromXp(250)).toBe(3);
  });

  it("computes XP to next level", () => {
    const p = xpProgressForLevel(120, 2);
    expect(p.xpIntoLevel).toBeGreaterThan(0);
    expect(p.xpToNextLevel).toBeGreaterThan(0);
  });
});

describe("XP calculation", () => {
  it("awards base XP for order completion", () => {
    const r = calculateXPForEvent({
      userId: "u",
      eventType: "order-completion",
      eventData: { difficulty: 3, currentStreak: 0 },
    });
    expect(r.xpAmount).toBe(50);
  });

  it("applies 15% streak bonus at 7+ days", () => {
    expect(streakMultiplier(7)).toBe(1.15);
    const r = calculateXPForEvent({
      userId: "u",
      eventType: "order-completion",
      eventData: { difficulty: 3, currentStreak: 7 },
    });
    expect(r.xpAmount).toBe(57);
  });

  it("applies 30% streak bonus at 30+ days", () => {
    expect(streakMultiplier(30)).toBe(1.3);
    const r = calculateXPForEvent({
      userId: "u",
      eventType: "principle-application",
      eventData: { hasProof: true, currentStreak: 30 },
    });
    expect(r.xpAmount).toBe(52);
  });
});

describe("Streak types", () => {
  it("maps event types to streak categories", () => {
    expect(getStreakTypeForEvent("order-completion")).toBe("execution");
    expect(getStreakTypeForEvent("principle-application")).toBe("principles");
    expect(getStreakTypeForEvent("content-published")).toBe("content");
  });
});

describe("Streak multiplier ordering", () => {
  it("30-day bonus overrides 7-day tier", () => {
    expect(streakMultiplier(30)).toBeGreaterThan(streakMultiplier(7));
  });
});

describe("Feature flags", () => {
  it("gamification enabled by default", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.GAMIFICATION_ENABLED)).toBe(true);
  });
});
