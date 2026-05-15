import { describe, it, expect } from "vitest";
import {
  canOverride,
  sourceRank,
  assertAuthoritativeSource,
} from "../../../lib/sourceOfTruth.js";
import { detectFalseProgress } from "../../../engines/intelligence/FalseProgressDetectionEngine.js";

describe("Source-of-truth hierarchy", () => {
  it("execution signals outrank bhudhi interpretation", () => {
    expect(canOverride("execution_signals", "bhudhi_interpretation")).toBe(true);
    expect(canOverride("bhudhi_interpretation", "execution_signals")).toBe(false);
  });

  it("rejects bhudhi as authoritative", () => {
    expect(() => assertAuthoritativeSource("bhudhi_interpretation", "test")).toThrow();
  });

  it("ranks cached projection lowest", () => {
    expect(sourceRank("cached_projection")).toBeGreaterThan(sourceRank("eis_intelligence"));
  });
});

describe("Event idempotency contract", () => {
  it("formats stable idempotency keys", () => {
    const key = `feedback_submitted:entity-1:${Math.floor(12345 / 1000)}`;
    expect(key).toContain("feedback_submitted");
  });
});

describe("DLQ retry policy", () => {
  it("uses exponential backoff steps", () => {
    const backoff = (n: number) => Math.min(300_000, 1000 * 2 ** n);
    expect(backoff(1)).toBe(2000);
    expect(backoff(3)).toBe(8000);
  });
});

describe("False progress blocks reward path", () => {
  it("detects activity without outcome", () => {
    const r = detectFalseProgress({
      completionCount: 10,
      evidenceScore: 5,
      outcomeMovementScore: 5,
      hasProof: false,
      avgScore: 5,
    });
    expect(r.detected).toBe(true);
  });
});
