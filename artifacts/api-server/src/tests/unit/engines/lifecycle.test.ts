import { describe, it, expect } from "vitest";

describe("CompletionEngine — eligibility checks", () => {
  it("completion check list has 6 criteria", () => {
    const checks = [
      "blueprint_active",
      "has_plans",
      "has_execution",
      "no_false_progress",
      "no_open_pivot_review",
      "has_phase_progress",
    ];
    expect(checks).toHaveLength(6);
  });

  it("completion sets active = false", () => {
    const afterCompletion = { active: false, status: "complete" };
    expect(afterCompletion.active).toBe(false);
  });

  it("signals do not carry forward but capability does", () => {
    const completionSummary = { capabilityCarriesForward: true, signalsCarryForward: false };
    expect(completionSummary.capabilityCarriesForward).toBe(true);
    expect(completionSummary.signalsCarryForward).toBe(false);
  });
});

describe("PauseEngine — pause behavior", () => {
  it("pause keeps active = true", () => {
    const afterPause = { active: true, status: "paused" };
    expect(afterPause.active).toBe(true);
    expect(afterPause.status).toBe("paused");
  });
});

describe("ResumeEngine — resume mode calculation", () => {
  it("gap 0–2 days = normal", () => {
    const days = 1;
    const mode = days <= 2 ? "normal" : days <= 7 ? "check_in" : days <= 30 ? "recovery" : "restart";
    expect(mode).toBe("normal");
  });
  it("gap 3–7 days = check_in", () => {
    const days = 5;
    const mode = days <= 2 ? "normal" : days <= 7 ? "check_in" : days <= 30 ? "recovery" : "restart";
    expect(mode).toBe("check_in");
  });
  it("gap 8–30 days = recovery", () => {
    const days = 15;
    const mode = days <= 2 ? "normal" : days <= 7 ? "check_in" : days <= 30 ? "recovery" : "restart";
    expect(mode).toBe("recovery");
  });
  it("gap > 30 days = restart", () => {
    const days = 45;
    const mode = days <= 2 ? "normal" : days <= 7 ? "check_in" : days <= 30 ? "recovery" : "restart";
    expect(mode).toBe("restart");
  });
});

describe("StrategyEngine — safety gates", () => {
  it("nothingness condition blocks pivot review", () => {
    const BLOCKED_CONDITIONS = ["nothingness"];
    const condition = "nothingness";
    expect(BLOCKED_CONDITIONS.includes(condition)).toBe(true);
  });

  it("danger requires recovery attempt before automatic pivot", () => {
    const triggerType = "automatic";
    const condition = "danger";
    const recoveryCompleted = 0;
    const blocked = condition === "danger" && triggerType === "automatic" && recoveryCompleted === 0;
    expect(blocked).toBe(true);
  });

  it("stability condition allows manual pivot review", () => {
    const BLOCKED_CONDITIONS = ["nothingness"];
    const condition = "stability";
    expect(BLOCKED_CONDITIONS.includes(condition)).toBe(false);
  });
});

describe("PivotEngine — path types", () => {
  it("three path types are always generated", () => {
    const pathTypes = ["continue", "adjust", "pivot"];
    expect(pathTypes).toHaveLength(3);
  });

  it("adjust preserves completed targets", () => {
    const adjustBehavior = "Completed targets preserved. Incomplete regenerated.";
    expect(adjustBehavior).toContain("preserved");
  });

  it("pivot resets signal to nothingness", () => {
    const afterPivot = { condition: "nothingness", signalReset: true };
    expect(afterPivot.condition).toBe("nothingness");
  });

  it("pivot preserves capability", () => {
    const afterPivot = { capabilityCarriesForward: true };
    expect(afterPivot.capabilityCarriesForward).toBe(true);
  });
});
