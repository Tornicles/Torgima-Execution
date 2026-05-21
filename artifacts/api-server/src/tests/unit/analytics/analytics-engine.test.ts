import { describe, it, expect } from "vitest";
import {
  computeMomentumFromRates,
  engagementTotal,
  exportToCsv,
  resolveDateRange,
  viralityScore,
} from "../../../engines/analytics/AnalyticsEngine.js";
import { FEATURE_FLAGS, isFeatureEnabledByDefault } from "../../../constants/feature-flags.js";

describe("resolveDateRange", () => {
  it("defaults week window to ~7 days", () => {
    const { startStr, endStr } = resolveDateRange("week");
    const start = new Date(startStr);
    const end = new Date(endStr);
    const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(6);
    expect(days).toBeLessThanOrEqual(8);
  });

  it("honors explicit start/end", () => {
    const r = resolveDateRange("month", "2026-01-01", "2026-01-31");
    expect(r.startStr).toBe("2026-01-01");
    expect(r.endStr).toBe("2026-01-31");
  });
});

describe("momentum", () => {
  it("returns 0 when historical rate is zero", () => {
    expect(computeMomentumFromRates(50, 0)).toBe(0);
  });

  it("clamps positive acceleration to 1", () => {
    expect(computeMomentumFromRates(100, 10)).toBe(1);
  });

  it("clamps heavy decline to -1", () => {
    expect(computeMomentumFromRates(10, 100)).toBe(-0.9);
  });
});

describe("viralityScore", () => {
  it("returns 0 with zero reach", () => {
    expect(viralityScore(100, 0)).toBe(0);
  });

  it("caps at 100 for high engagement", () => {
    expect(viralityScore(5000, 100)).toBe(100);
  });

  it("rises with engagement rate", () => {
    const low = viralityScore(10, 1000);
    const high = viralityScore(200, 1000);
    expect(high).toBeGreaterThan(low);
  });
});

describe("engagementTotal", () => {
  it("sums flat numeric fields", () => {
    expect(engagementTotal({ likes: 3, comments: 2 })).toBe(5);
  });

  it("sums nested platform metrics", () => {
    expect(
      engagementTotal({
        twitter: { likes: 1, comments: 2, shares: 3, impressions: 4 },
      }),
    ).toBe(10);
  });
});

describe("exportToCsv", () => {
  it("serializes sections with scalar values", () => {
    const csv = exportToCsv({ meta: { generatedAt: "2026-05-01", range: "month" } });
    expect(csv).toContain("section,key,value");
    expect(csv).toContain("generatedAt");
    expect(csv).toContain("month");
  });

  it("records array lengths under section", () => {
    const csv = exportToCsv({ execution: [{ metric_date: "2026-05-01" }] });
    expect(csv).toContain("execution,count,1");
  });
});

describe("feature flag", () => {
  it("analytics_enabled defaults on in phase 1", () => {
    expect(isFeatureEnabledByDefault(FEATURE_FLAGS.ANALYTICS_ENABLED)).toBe(true);
  });
});
