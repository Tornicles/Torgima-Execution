/**
 * Unit tests for ValidationEngine scoring and verdict determination.
 * Run: pnpm --filter @workspace/api-server run test
 */

import { describe, it, expect } from "vitest";
import {
  scoreGoal,
  determineVerdict,
  structureGoalDeterministic,
  scoreToVerdict,
} from "../../engines/validation/ValidationEngine.js";

// ── SCORE GOAL ───────────────────────────────────────────────────────────────

describe("scoreGoal", () => {
  it("returns low overall for a vague one-word goal", () => {
    const scores = scoreGoal({ goal: "success" });
    expect(scores.overall).toBeLessThan(50);
    expect(scores.clarity.verdict).toBe("critical");
  });

  it("returns higher score with measurable outcome", () => {
    const scores = scoreGoal({
      goal: "Reach $10,000 MRR within 6 months by converting 100 free users to paid",
      purpose: "Become financially independent and quit my job",
      timeframe: "6 months",
      commitmentLevel: "full",
      currentContext: "Currently at $0 MRR, have a working product with 200 free users",
      successSignal: "Hit $10k MRR",
    });
    expect(scores.overall).toBeGreaterThan(60);
    expect(scores.clarity.score).toBeGreaterThan(60);
  });

  it("applies vague-term penalty", () => {
    const vague  = scoreGoal({ goal: "I want to maybe possibly get better at something things" });
    const specific = scoreGoal({ goal: "Ship 3 new features to my SaaS app within 4 weeks" });
    expect(specific.clarity.score).toBeGreaterThan(vague.clarity.score);
  });

  it("adds purpose bonus when purpose is substantial", () => {
    const withPurpose    = scoreGoal({ goal: "Build a product", purpose: "To become financially free" });
    const withoutPurpose = scoreGoal({ goal: "Build a product" });
    expect(withPurpose.clarity.score).toBeGreaterThanOrEqual(withoutPurpose.clarity.score);
  });

  it("penalises missing timeframe in feasibility", () => {
    const withTime    = scoreGoal({ goal: "Build a product", timeframe: "3 months" });
    const withoutTime = scoreGoal({ goal: "Build a product" });
    expect(withTime.feasibility.score).toBeGreaterThan(withoutTime.feasibility.score);
  });

  it("adds context bonus in realism", () => {
    const withCtx    = scoreGoal({ goal: "Scale to 1000 users", currentContext: "Currently at 50 paying customers on Shopify" });
    const withoutCtx = scoreGoal({ goal: "Scale to 1000 users" });
    expect(withCtx.realism.score).toBeGreaterThan(withoutCtx.realism.score);
  });

  it("adds usefulness bonus with purpose and success signal", () => {
    const with_   = scoreGoal({ goal: "Build a product", purpose: "To achieve financial freedom by 30", successSignal: "Quit my job" });
    const without = scoreGoal({ goal: "Build a product" });
    expect(with_.usefulness.score).toBeGreaterThan(without.usefulness.score);
  });

  it("overall is weighted average of four dimensions", () => {
    const scores = scoreGoal({
      goal: "Ship MVP in 8 weeks",
      timeframe: "8 weeks",
      commitmentLevel: "high",
      purpose: "Validate my idea",
      currentContext: "Currently at prototype stage",
    });
    const expected = Math.round(
      scores.clarity.score     * 0.30 +
      scores.feasibility.score * 0.25 +
      scores.realism.score     * 0.25 +
      scores.usefulness.score  * 0.20,
    );
    expect(scores.overall).toBe(expected);
  });

  it("score is always clamped to 0–100", () => {
    const scores = scoreGoal({ goal: "a" });
    expect(scores.clarity.score).toBeGreaterThanOrEqual(0);
    expect(scores.clarity.score).toBeLessThanOrEqual(100);
  });
});

// ── DETERMINE VERDICT ────────────────────────────────────────────────────────

describe("determineVerdict", () => {
  it("returns pivot when clarity is critical", () => {
    const scores = scoreGoal({ goal: "s" });
    expect(determineVerdict(scores)).toBe("pivot");
  });

  it("returns proceed for a well-specified goal", () => {
    const scores = scoreGoal({
      goal: "Reach $10,000 MRR within 6 months by converting 100 free users to paid",
      purpose: "Become financially independent — quit job by end of year",
      timeframe: "6 months",
      commitmentLevel: "full",
      currentContext: "Currently at $0 MRR with 200 free users on the platform",
      successSignal: "Hit $10k MRR and quit job",
    });
    // High-quality goal should produce proceed or adjust, never pivot
    expect(["proceed", "adjust"]).toContain(determineVerdict(scores));
  });

  it("returns pivot when overall < 35", () => {
    const scores = {
      clarity:     { score: 10, verdict: "weak" as const, finding: "" },
      feasibility: { score: 20, verdict: "weak" as const, finding: "" },
      realism:     { score: 20, verdict: "weak" as const, finding: "" },
      usefulness:  { score: 20, verdict: "weak" as const, finding: "" },
      overall:     17,
    };
    expect(determineVerdict(scores)).toBe("pivot");
  });

  it("returns adjust for middle range scores", () => {
    const scores = {
      clarity:     { score: 50, verdict: "acceptable" as const, finding: "" },
      feasibility: { score: 50, verdict: "acceptable" as const, finding: "" },
      realism:     { score: 50, verdict: "acceptable" as const, finding: "" },
      usefulness:  { score: 50, verdict: "acceptable" as const, finding: "" },
      overall:     50,
    };
    expect(determineVerdict(scores)).toBe("adjust");
  });
});

// ── SCORE TO VERDICT ─────────────────────────────────────────────────────────

describe("scoreToVerdict", () => {
  it("maps 75 → strong", () => expect(scoreToVerdict(75)).toBe("strong"));
  it("maps 60 → acceptable", () => expect(scoreToVerdict(60)).toBe("acceptable"));
  it("maps 40 → weak", () => expect(scoreToVerdict(40)).toBe("weak"));
  it("maps 20 → critical", () => expect(scoreToVerdict(20)).toBe("critical"));
});

// ── STRUCTURE GOAL DETERMINISTIC ─────────────────────────────────────────────

describe("structureGoalDeterministic", () => {
  it("returns INVALID when goal is empty", () => {
    const result = structureGoalDeterministic({ rawGoal: "" });
    expect(result.validationVerdict).toBe("INVALID");
    expect(result.missingRequiredFields).toContain("goal");
  });

  it("returns NEEDS_CLARIFICATION when purpose is missing", () => {
    const result = structureGoalDeterministic({
      rawGoal: "Build a SaaS product and reach $10k MRR",
      timeframe: "6 months",
      commitmentLevel: "high",
    });
    expect(result.validationVerdict).toBe("NEEDS_CLARIFICATION");
    expect(result.missingRequiredFields).toContain("purpose");
  });

  it("returns VALID when all required fields are present", () => {
    const result = structureGoalDeterministic({
      rawGoal:         "Build a SaaS product and reach $10k MRR",
      purpose:         "Achieve financial independence",
      timeframe:       "6 months",
      commitmentLevel: "high",
    });
    expect(result.validationVerdict).toBe("VALID");
    expect(result.missingRequiredFields).toHaveLength(0);
  });

  it("includes success signals when provided", () => {
    const result = structureGoalDeterministic({
      rawGoal:       "Build a product",
      purpose:       "Freedom",
      timeframe:     "3 months",
      successSignal: "Quit my job",
    });
    expect(result.successSignals).toContain("Quit my job");
  });

  it("includes blockers when provided", () => {
    const result = structureGoalDeterministic({
      rawGoal:       "Build a product",
      purpose:       "Freedom",
      timeframe:     "3 months",
      knownBlockers: "Procrastination and distractions",
    });
    expect(result.blockers).toContain("Procrastination and distractions");
  });

  it("preserves the raw goal as cleanedGoal", () => {
    const raw = "  Build a product and sell it  ";
    const result = structureGoalDeterministic({ rawGoal: raw });
    expect(result.cleanedGoal).toBe(raw.trim());
  });
});
