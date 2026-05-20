/**
 * Bhudhi B4 — Advanced intelligence reconnection (T1–T5 unit coverage).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildEisExecutionFields,
  fetchDashboardIntelligence,
  runFeedbackCriticCheck,
  fetchRecoveryCoachingCopy,
} from "../../../bhudhi/AdvancedIntelligenceBridge.js";
import type { EISIntelligence } from "../../../engines/validation/intelligence/validation-intelligence-types.js";

vi.mock("../../../bhudhi/TriggerRouter.js", () => ({
  routeBhudhiRequest: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ enabled: true }]),
        })),
      })),
    })),
  },
  featureFlags: { feature_name: "feature_name", enabled: "enabled" },
}));

vi.mock("../../../bhudhi/MemoryService.js", () => ({
  retrieveMemory: vi.fn().mockResolvedValue(""),
}));

describe("B4 EIS execution fields (T1)", () => {
  it("maps EIS intelligence to demand/saturation/context fields", () => {
    const eis: EISIntelligence = {
      industry: "SaaS",
      niche: "B2B productivity",
      domain: "market",
      macro_trends: [],
      micro_trends: [],
      demand_signal: {
        direction: "rising",
        strength: "strong",
        evidence: ["Growing SMB adoption"],
        demand_type: "emerging",
      },
      saturation_level: "medium",
      opportunity_windows: [],
      competitor_landscape: [],
      platform_context: [],
      strategic_windows: [],
      last_updated: new Date().toISOString(),
      confidence_score: 80,
      source: "EIS",
    };

    const fields = buildEisExecutionFields(eis);
    expect(fields.eis_demand_score).toBeGreaterThan(0);
    expect(fields.eis_saturation_score).toBeGreaterThan(0);
    expect(fields.eis_industry_context).toContain("SaaS");
  });
});

describe("B4 Dashboard intelligence (T2, T5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns headline from STATE_EXPLANATION", async () => {
    const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
    vi.mocked(routeBhudhiRequest).mockResolvedValue({
      ok: true,
      fallbackUsed: false,
      logId: "log-1",
      output: {
        outputType: "state_explanation",
        contractVersion: "1.0",
        stateVersion: 1,
        confidence: "HIGH",
        data: {
          headline: "Momentum is rising",
          explanation: "Your completion rate supports the next order.",
          nextActionReason: "Finish the active order to lock in signal gains.",
        },
        missingFields: [],
        warnings: [],
        forbiddenActionRequested: false,
      },
    });

    const intel = await fetchDashboardIntelligence({
      userId: "u1",
      blueprintId: "bp1",
      stateVersion: 1,
      condition: "urgency",
      completionRate: 0.7,
      momentum: 5,
      trend: "rising",
      goal: "Launch SaaS",
    });

    expect(intel.headline).toBe("Momentum is rising");
    expect(intel.fallbackUsed).toBe(false);
  });

  it("uses fallback when Bhudhi fails (T5)", async () => {
    const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
    vi.mocked(routeBhudhiRequest).mockRejectedValue(new Error("BHUDHI_NO_API_KEY"));

    const intel = await fetchDashboardIntelligence({
      userId: "u1",
      blueprintId: "bp1",
      stateVersion: 1,
      condition: "stability",
      completionRate: 0.5,
      momentum: 2,
      trend: "stable",
      goal: "Test goal",
    });

    expect(intel.headline.length).toBeGreaterThan(0);
    expect(intel.fallbackUsed).toBe(true);
  });
});

describe("B4 Feedback critic (T3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets interrogation on gaming signal for high score + brief reflection", async () => {
    const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
    vi.mocked(routeBhudhiRequest).mockResolvedValue({
      ok: true,
      fallbackUsed: false,
      logId: "log-critic",
      output: {
        outputType: "blocker_classification",
        contractVersion: "1.0",
        stateVersion: 1,
        confidence: "MEDIUM",
        data: {
          blockerCategory: "GAMING_SIGNAL",
          severity: "MEDIUM",
          needsDependencyResolution: false,
          needsRecoveryTask: false,
          summary: "gaming signal detected",
        },
        missingFields: [],
        warnings: [],
        forbiddenActionRequested: false,
      },
    });

    const result = await runFeedbackCriticCheck({
      userId: "u1",
      blueprintId: "bp1",
      feedbackId: "fb1",
      score: 9,
      reflection: "Done today.",
      stateVersion: 1,
    });

    expect(result.requiresInterrogation).toBe(true);
    expect(result.interrogationQuestion).toMatch(/brief/i);
    expect(result.gamingSignal).toBe(true);
  });
});

describe("B4 Recovery coaching (T4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses RECOVERY_COPY output when available", async () => {
    const { routeBhudhiRequest } = await import("../../../bhudhi/TriggerRouter.js");
    vi.mocked(routeBhudhiRequest).mockResolvedValue({
      ok: true,
      fallbackUsed: false,
      logId: "log-rec",
      output: {
        outputType: "recovery_copy",
        contractVersion: "1.0",
        stateVersion: 1,
        confidence: "HIGH",
        data: {
          title: "Restart after missed proof",
          instruction: "Upload the proof file you skipped yesterday, then submit feedback.",
          expectedOutput: "Proof uploaded",
          tone: "CALM",
        },
        missingFields: [],
        warnings: [],
        forbiddenActionRequested: false,
      },
    });

    const { retrieveMemory } = await import("../../../bhudhi/MemoryService.js");
    vi.mocked(retrieveMemory).mockResolvedValue("proof upload friction");

    const copy = await fetchRecoveryCoachingCopy({
      userId: "u1",
      blueprintId: "bp1",
      stateVersion: 2,
      goal: "Launch SaaS",
      currentCondition: "recovery",
      failureReason: "proof upload blocked",
    });

    expect(copy.instruction).toContain("proof");
    expect(copy.usedBhudhi).toBe(true);
  });
});
