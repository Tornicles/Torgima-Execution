import { describe, it, expect, vi, beforeEach } from "vitest";
import { TorgimaIntegration } from "../../../bhudhi/integration/TorgimaIntegration.js";

vi.mock("../../../bhudhi/investigation/InvestigationService.js", () => ({
  investigationService: {
    investigateBlueprint: vi.fn().mockResolvedValue([
      {
        id: "inv-1",
        blueprintId: "bp-1",
        engineId: "inv_data_collection",
        subject: "execution",
        findings: { insights: ["Insight A", "Insight B"], patterns: [], anomalies: [], rootCauses: [], benchmarks: {} },
        confidence: 0.8,
        severity: "low",
        actionable: true,
      },
    ]),
  },
}));

vi.mock("../../../bhudhi/intelligence/IntelligenceService.js", () => ({
  intelligenceService: {
    analyzeAndRecommend: vi.fn().mockResolvedValue([
      {
        id: "rec-1",
        blueprintId: "bp-1",
        title: "Accelerate delivery",
        description: "Focus on highest-value order",
        reasoning: "SYNERGYOPS framework",
        confidence: 0.88,
        status: "pending",
      },
    ]),
    listRecommendations: vi.fn().mockResolvedValue([]),
    getRecommendation: vi.fn(),
  },
}));

vi.mock("../../../bhudhi/signals/SignalService.js", () => ({
  signalService: {
    calculateSignals: vi.fn().mockResolvedValue({
      globalSignal: "power",
      globalSignalConfidence: 0.82,
    }),
  },
}));

vi.mock("../../../bhudhi/domains/DomainsService.js", () => ({
  domainsService: {
    checkDomainTransition: vi.fn().mockResolvedValue({ transition: true, newDomain: "market" }),
  },
}));

vi.mock("../../../bhudhi/modules/ModulesService.js", () => ({
  modulesService: {
    runCompleteCycle: vi.fn().mockResolvedValue({
      investigation: { context: { currentDomain: "delivery" }, external: {}, behavior: {} },
      intelligence: { strategy: { selected: "Hybrid approach" } },
      executionPlan: { steps: [] },
      security: { validated: true },
      preservation: { preserved: true },
      readyToExecute: true,
    }),
  },
}));

describe("BHUDHI PROMPT 12 — Torgima integration", () => {
  const integration = new TorgimaIntegration();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processTaskFeedback returns top recommendation and insights", async () => {
    const result = await integration.processTaskFeedback("bp-1", "order-1", {
      completionStatus: "completed",
    });

    expect(result.investigationCount).toBe(1);
    expect(result.recommendationCount).toBe(1);
    expect(result.signals).toBe("power");
    expect(result.insights).toContain("Insight A");
    expect(result.nextTaskRecommendation?.title).toBe("Accelerate delivery");
  });

  it("validateGoalWithBhudhi returns confidence and recommendations", async () => {
    const result = await integration.validateGoalWithBhudhi(
      "Launch a sustainable coaching business with recurring revenue",
      "Help professionals execute consistently",
    );

    expect(result.validated).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("getNextTaskBhudhiPayload returns top recommendation fields", async () => {
    const payload = await integration.getNextTaskBhudhiPayload("bp-1");
    expect(payload.success).toBe(true);
    expect(payload.nextTask).toBe("Accelerate delivery");
    expect(payload.confidence).toBe(0.88);
  });

  it("checkDomainTransition delegates to domains service", async () => {
    const result = await integration.checkDomainTransition("bp-1", "genesis");
    expect(result.transition).toBe(true);
    expect(result.newDomain).toBe("market");
  });

  it("resolveDomainFromCompletionRate maps maturity", () => {
    expect(integration.resolveDomainFromCompletionRate(0)).toBe("genesis");
    expect(integration.resolveDomainFromCompletionRate(0.9)).toBe("growth");
  });
});
