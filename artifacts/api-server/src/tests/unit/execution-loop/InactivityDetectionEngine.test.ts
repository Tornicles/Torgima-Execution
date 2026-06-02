import { describe, it, expect } from "vitest";
import {
  scaleThresholdMinutes,
  severityForType,
  maxSeverity,
  parseCommitmentLevel,
  PHASE1_INACTIVITY_THRESHOLDS_MIN,
} from "../../../engines/inactivity/InactivityThresholds.js";
import { InactivityDetectionEngine } from "../../../engines/execution-loop/InactivityDetectionEngine.js";

describe("InactivityDetectionEngine — Phase 1 thresholds", () => {
  it("scales NO_SESSION threshold by commitment", () => {
    const base = PHASE1_INACTIVITY_THRESHOLDS_MIN.NO_SESSION;
    expect(scaleThresholdMinutes(base, "LOW")).toBeGreaterThan(scaleThresholdMinutes(base, "INTENSE"));
    expect(scaleThresholdMinutes(base, "MEDIUM")).toBe(base);
  });

  it("parses commitment levels", () => {
    expect(parseCommitmentLevel("high")).toBe("HIGH");
    expect(parseCommitmentLevel(undefined)).toBe("MEDIUM");
  });

  it("assigns severity by inactivity type", () => {
    expect(severityForType("ABANDONED_LOOP")).toBe("CRITICAL");
    expect(severityForType("NO_SESSION")).toBe("LOW");
    expect(maxSeverity("LOW", "CRITICAL")).toBe("CRITICAL");
  });
});

describe("InactivityDetectionEngine — surface", () => {
  it("exposes scanAll on class", () => {
    const engine = new InactivityDetectionEngine();
    expect(typeof engine.scanAll).toBe("function");
  });
});
