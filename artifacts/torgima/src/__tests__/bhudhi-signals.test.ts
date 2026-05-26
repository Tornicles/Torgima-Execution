import { describe, it, expect } from "vitest";
import {
  formatConfidence,
  getSignalColor,
  getSignalLabel,
  GLOBAL_SIGNALS,
} from "@/lib/bhudhi-signals";

describe("Bhudhi signal UI helpers", () => {
  it("maps all seven global signals to colors and labels", () => {
    for (const signal of GLOBAL_SIGNALS) {
      expect(getSignalColor(signal)).toMatch(/bg-/);
      expect(getSignalLabel(signal).length).toBeGreaterThan(0);
    }
  });

  it("formats confidence as percentage", () => {
    expect(formatConfidence(0.85)).toBe("85%");
    expect(formatConfidence(null)).toBe("—");
  });
});
