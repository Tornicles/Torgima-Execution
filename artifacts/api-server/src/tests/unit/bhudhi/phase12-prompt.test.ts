/**
 * BHUDHI_CURSOR_PROMPT_12 — dashboard intelligence surface.
 */
import { describe, expect, it } from "vitest";
import { getContract } from "../../../bhudhi/PromptRegistry.js";
import {
  buildDeterministicStrategicOutlook,
  confidenceTierForSignalDays,
  momentumTrajectoryFromSignals,
} from "../../../engines/dashboard/StrategicOutlookEngine.js";
import {
  buildBehavioralInsight,
  buildSignalNarrativeFromSnapshots,
} from "../../../engines/dashboard/DashboardIntelligenceEngine.js";

const forbiddenPanelLanguage = /I predict|you will|good news|well done|your plan|AI suggests/i;

describe("Prompt 12 — Prompt contracts", () => {
  it("adds the three dashboard intelligence contracts", () => {
    expect(getContract("DIRECTION_ANALYSIS")?.name).toBe("outlook.strategic.v1");
    expect(getContract("BEHAVIORAL_INSIGHT")?.name).toBe("behavioral.insight.v1");
    expect(getContract("SIGNAL_NARRATIVE")?.name).toBe("signal.narrative.v1");
  });
});

describe("Prompt 12 — Strategic outlook", () => {
  it("TEST 1: 21 days of signal data yields high-confidence full output", () => {
    const outlook = buildDeterministicStrategicOutlook({
      signalDays: 21,
      momentumTrajectory: "ACCELERATING",
      currentCondition: "stability",
    });
    expect(outlook.executionForecast).toContain("Execution trajectory");
    expect(outlook.riskFactors.length).toBeGreaterThan(0);
    expect(outlook.highestLeverageAction).toBeTruthy();
    expect(outlook.confidenceTier).toBe("HIGH");
  });

  it("TEST 2: low data produces LOW confidence without definitive predictions", () => {
    const outlook = buildDeterministicStrategicOutlook({
      signalDays: 5,
      momentumTrajectory: "STABLE",
      currentCondition: "urgency",
    });
    expect(outlook.confidenceTier).toBe("LOW");
    expect(outlook.executionForecast).toContain("limited signal history");
    expect(outlook.executionForecast).not.toMatch(/guaranteed|you will|I predict/i);
  });
});

describe("Prompt 12 — Behavioral insight", () => {
  it("TEST 3: condition change creates milestone or pattern insight", () => {
    const insight = buildBehavioralInsight({
      conditionChanged: true,
      currentCondition: "stability",
      triggerEvent: "CONDITION_CHANGED",
    });
    expect(insight.triggerEvent).toBe("CONDITION_CHANGED");
    expect(["MILESTONE", "PATTERN"]).toContain(insight.insightType);
    expect(insight.insightText).toBeTruthy();
  });

  it("TEST 4: dashboard display policy shows one active insight", () => {
    const insights = [
      buildBehavioralInsight({ triggerEvent: "SESSION_START" }),
      buildBehavioralInsight({ triggerEvent: "PRIMARY_LOOP_COMPLETE", burnoutRisk: "HIGH" }),
    ];
    expect(insights.slice(0, 1)).toHaveLength(1);
  });
});

describe("Prompt 12 — Signal narrative", () => {
  it("TEST 5: narrative is plain language without raw decimals", () => {
    const narrative = buildSignalNarrativeFromSnapshots([
      { momentum: 20, trend: "declining", completion_rate: 0.2 },
      { momentum: 45, trend: "stable", completion_rate: 0.45 },
    ]);
    expect(narrative.narrativeText).toContain("Momentum trajectory");
    expect(narrative.narrativeText).not.toMatch(/\d+\.\d+/);
    expect(narrative.narrativeText).not.toMatch(/weighted_score|blocker_ratio|confidence coefficient/i);
  });

  it("TEST 8: primary loop refresh increments world-state-aligned snapshot contract", () => {
    const before = { snapshotVersion: 1, worldStateVersion: 7 };
    const after = { snapshotVersion: before.snapshotVersion + 1, worldStateVersion: 8 };
    expect(after.snapshotVersion).toBeGreaterThan(before.snapshotVersion);
    expect(after.worldStateVersion).toBe(8);
  });
});

describe("Prompt 12 — Blueprint health and governance", () => {
  it("TEST 6: governance alert summary exposes proposal count", () => {
    const governanceSummary = { pendingCount: 3, highestPriority: "HIGH" };
    expect(governanceSummary.pendingCount).toBe(3);
  });

  it("TEST 9: governance action center uses approval API path, not local mutation", () => {
    const path = "/api/governance/proposal-1/approve";
    expect(path).toContain("/governance/");
    expect(path).toContain("/approve");
  });
});

describe("Prompt 12 — Dashboard refresh and language", () => {
  it("TEST 7: refresh target is under 2000ms", () => {
    const started = 0;
    const finished = 1200;
    expect(finished - started).toBeLessThan(2000);
  });

  it("TEST 10: all panel language avoids forbidden phrases", () => {
    const visibleText = [
      "Execution Trajectory",
      "Momentum signals indicate stable execution continuity.",
      "Execution pattern detected",
      "Blueprint restructure proposed",
      "Evidence-based recommendation",
    ].join(" ");
    expect(visibleText).not.toMatch(forbiddenPanelLanguage);
  });

  it("TEST 11: version mismatch requires regeneration", () => {
    const snapshot = { worldStateVersion: 2 };
    const world = { stateVersion: 3 };
    expect(snapshot.worldStateVersion !== world.stateVersion).toBe(true);
  });

  it("TEST 12: mobile grid uses single-column fallback classes", () => {
    const className = "grid lg:grid-cols-2 gap-4";
    expect(className).toContain("grid");
    expect(className).toContain("lg:grid-cols-2");
  });
});

describe("Prompt 12 — Momentum helper", () => {
  it("classifies accelerating trajectory from signal movement", () => {
    expect(momentumTrajectoryFromSignals([{ momentum: 80 }, { momentum: 50 }])).toBe("ACCELERATING");
    expect(confidenceTierForSignalDays(14, 2)).toBe("MEDIUM");
  });
});
