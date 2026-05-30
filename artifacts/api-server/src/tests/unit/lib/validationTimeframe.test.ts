import { describe, expect, it } from "vitest";
import {
  mergeValidationTimeframeFromRow,
  parseTimeframeDaysFromString,
  resolveValidationTimeframeFields,
} from "../../../lib/validationTimeframe.js";

describe("validationTimeframe", () => {
  it("parses 90 days string", () => {
    expect(parseTimeframeDaysFromString("90 days")).toBe(90);
    expect(parseTimeframeDaysFromString("90")).toBe(90);
  });

  it("resolves timeframe from customTimeframeDays", () => {
    const out = resolveValidationTimeframeFields({
      timeframe: "90 days",
      customTimeframeDays: 90,
    });
    expect(out.timeframe_days).toBe(90);
    expect(out.timeframe).toBe("90 days");
  });

  it("merges timeframe from validation_feed and blueprint", () => {
    const merged = mergeValidationTimeframeFromRow(
      {
        timeframe: null,
        timeframe_days: null,
        validation_feed: { timeframe: { duration_days: 90 } },
      },
      { timeframe_days: 90 },
    );
    expect(merged.timeframe_days).toBe(90);
    expect(merged.timeframe).toBe("90 days");
  });

  it("derives timeframe_days from start/end dates", () => {
    const merged = mergeValidationTimeframeFromRow({
      timeframe_start: new Date("2026-01-01"),
      timeframe_end: new Date("2026-04-01"),
    });
    expect(merged.timeframe_days).toBeGreaterThan(80);
    expect(merged.timeframe).toContain("days");
  });
});
