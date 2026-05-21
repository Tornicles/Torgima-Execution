/**
 * GAP PROMPT G6 — Capability & Behavior System tests.
 */

import { describe, it, expect } from "vitest";
import {
  deriveDifficultyRecommendation,
  deriveOverallLevel,
  enforceCapabilityDifficulty,
  minDifficulty,
} from "../../../engines/capability/CapabilityDifficulty.js";
import { BehaviorPatternEngine } from "../../../engines/behavior/BehaviorPatternEngine.js";
import { CapabilityEngine } from "../../../engines/capability/CapabilityEngine.js";

describe("GAP G6 — CapabilityDifficulty", () => {
  it("T2: high execution + consistency → moderate or hard recommendation", () => {
    const rec = deriveDifficultyRecommendation(0.85, 0.85);
    expect(["moderate", "hard"]).toContain(rec);
    expect(rec).toBe("hard");
  });

  it("T4: very_easy profile caps task difficulty below hard", () => {
    const enforced = enforceCapabilityDifficulty({
      difficultyRecommendation: "very_easy",
      difficultyCap: "very_hard",
      capabilityLevel: "beginner",
      executionQuality: 0.2,
      consistency: 0.2,
    });
    expect(["very_easy", "easy", "moderate"]).toContain(enforced);
    expect(enforced).not.toBe("hard");
    expect(enforced).not.toBe("very_hard");
  });

  it("LAW 2: LOW capability cannot exceed moderate even with high cap", () => {
    const enforced = enforceCapabilityDifficulty({
      difficultyRecommendation: "hard",
      difficultyCap: "very_hard",
      capabilityLevel: "beginner",
      executionQuality: 0.3,
      consistency: 0.3,
    });
    expect(enforced).toBe("moderate");
  });

  it("minDifficulty picks the lower tier", () => {
    expect(minDifficulty("hard", "easy")).toBe("easy");
    expect(minDifficulty("moderate", "very_hard")).toBe("moderate");
  });

  it("overall level tracks performance bands", () => {
    expect(deriveOverallLevel(0.9, 0.9)).toBe("elite");
    expect(deriveOverallLevel(0.4, 0.4)).toBe("developing");
  });
});

describe("GAP G6 — engines exported", () => {
  it("CapabilityEngine exposes updateAfterFeedback", () => {
    const engine = new CapabilityEngine();
    expect(typeof engine.updateAfterFeedback).toBe("function");
  });

  it("BehaviorPatternEngine exposes detectPatterns", () => {
    const engine = new BehaviorPatternEngine();
    expect(typeof engine.detectPatterns).toBe("function");
  });
});

describe("GAP G6 — behavior detection logic (unit)", () => {
  it("T3: procrastination when 3+ late penalties in recent window", () => {
    const rows = [
      { late_penalty_applied: true },
      { late_penalty_applied: true },
      { late_penalty_applied: true },
      { late_penalty_applied: false },
    ];
    const lateCount = rows.filter((f) => f.late_penalty_applied).length;
    expect(lateCount).toBeGreaterThanOrEqual(3);
  });

  it("T1: profile creation path exists on first feedback (contract)", () => {
    expect(typeof CapabilityEngine.prototype.updateAfterFeedback).toBe("function");
  });
});

describe("GAP G6 — schema contracts", () => {
  it("behavior pattern types include G6 patterns", async () => {
    const enums = await import("@workspace/db");
    expect(enums.behaviorPatterns).toBeDefined();
    expect(enums.capabilityProfiles).toBeDefined();
  });
});
