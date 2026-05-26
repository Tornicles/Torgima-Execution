import { describe, expect, it } from "vitest";
import {
  calculateFrameworkSignalsFromFeedback,
  calculateGrowth,
  calculateOperations,
  calculateProduction,
  calculateScale,
  interpretSignalValue,
  signalConfidenceFromSampleCount,
  trendFromHistory,
} from "../../../engines/signal/FrameworkSignalCalculationEngine.js";

function fb(partial: {
  completion_status: string;
  score?: number;
  blocker?: boolean;
  reflection?: string;
}) {
  return {
    completion_status: partial.completion_status,
    score: partial.score ?? 7,
    weighted_score: partial.score ?? 7,
    blocker_json: partial.blocker ? { type: "test" } : null,
    reflection: partial.reflection ?? "",
  } as Parameters<typeof calculateProduction>[0][number];
}

describe("FrameworkSignalCalculationEngine (SIGNAL_SYSTEM_SPECIFICATION)", () => {
  it("calculates production with partial weighting", () => {
    const rows = [
      ...Array(7).fill(fb({ completion_status: "completed" })),
      ...Array(2).fill(fb({ completion_status: "partial" })),
      fb({ completion_status: "failed" }),
    ];
    expect(calculateProduction(rows)).toBeCloseTo(0.8, 2);
  });

  it("calculates operations with blocker penalty", () => {
    const rows = Array(10)
      .fill(null)
      .map((_, i) =>
        fb({
          completion_status: "completed",
          score: [8, 7, 6, 7, 8, 9, 5, 7, 6, 8][i],
          blocker: i < 3,
        }),
      );
    const ops = calculateOperations(rows);
    expect(ops).toBeGreaterThan(0.45);
    expect(ops).toBeLessThan(0.55);
  });

  it("builds four-signal bundle", () => {
    const rows = Array(10)
      .fill(null)
      .map(() => fb({ completion_status: "completed", score: 8 }));
    const bundle = calculateFrameworkSignalsFromFeedback(rows);
    expect(bundle.signals.Production.value).toBeGreaterThan(0.9);
    expect(bundle.signals.Operations.value).toBeGreaterThan(0.7);
    expect(bundle.feedbackCount).toBe(10);
  });

  it("confidence grows with sample count toward 0.9", () => {
    expect(signalConfidenceFromSampleCount(1)).toBeCloseTo(0.36, 1);
    expect(signalConfidenceFromSampleCount(10)).toBeCloseTo(0.9, 1);
  });

  it("labels production bands", () => {
    expect(interpretSignalValue("Production", 0.85)).toBe("Good");
    expect(interpretSignalValue("Production", 0.25)).toBe("Critical");
  });

  it("scale penalizes variance and skips", () => {
    const chaotic = Array(10)
      .fill(null)
      .map((_, i) =>
        fb({
          completion_status: i % 3 === 0 ? "skipped" : "completed",
          score: i % 2 === 0 ? 9 : 4,
        }),
      );
    const steady = Array(10)
      .fill(null)
      .map(() => fb({ completion_status: "completed", score: 8 }));
    expect(calculateScale(chaotic)).toBeLessThan(calculateScale(steady));
  });

  it("detects improving trend from history (last 5 vs prior 5)", () => {
    const improving = [0.5, 0.52, 0.55, 0.58, 0.6, 0.62, 0.65, 0.68, 0.72, 0.76];
    expect(trendFromHistory(improving)).toBe("improving");
    const declining = [0.8, 0.78, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4];
    expect(trendFromHistory(declining)).toBe("declining");
  });

  it("growth responds to improving scores", () => {
    const improving = [
      ...Array(5).fill(fb({ completion_status: "completed", score: 9 })),
      ...Array(5).fill(fb({ completion_status: "completed", score: 5 })),
    ];
    const flat = Array(10).fill(fb({ completion_status: "completed", score: 7 }));
    expect(calculateGrowth(improving)).toBeGreaterThan(calculateGrowth(flat));
  });
});
