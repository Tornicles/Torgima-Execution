import { describe, it, expect, vi, beforeEach } from "vitest";

const BP = "00000000-0000-4000-8000-000000000039";

const mockCycle = {
  chainId: "cycle_test",
  status: "completed" as const,
  message: "ok",
  eventIds: ["e1"],
  contracts: ["c1"],
  context: {
    blueprintId: BP,
    domain: "genesis",
    phase: "execution",
    signal: "power",
    condition: "power",
    context: {},
    ideas: {},
    strategy: { selected: "Ship milestone", reasoning: "Momentum" },
    predictions: {},
    knowledge: {},
    behavior: {},
    execution: {},
    investigations: {},
    version: 2,
    lastUpdateEngine: "kernel",
  },
};

vi.mock("../../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js", () => ({
  cognitiveKernel: {
    runCycle: vi.fn().mockResolvedValue(mockCycle),
  },
  CognitiveKernel: vi.fn(),
}));

vi.mock("../../../bhudhi/signals/SignalService.js", () => ({
  signalService: {
    calculateSignals: vi.fn().mockResolvedValue({ globalSignal: "power", globalSignalConfidence: 0.9 }),
  },
}));

vi.mock("../../../bhudhi/intelligence/IntelligenceService.js", () => ({
  intelligenceService: {
    listRecommendations: vi.fn().mockResolvedValue([
      {
        id: "rec-1",
        title: "Accelerate delivery",
        description: "Focus highest-value order",
        reasoning: "SYNERGYOPS",
        confidence: 0.88,
      },
    ]),
  },
}));

vi.mock("../../../bhudhi/kernel/shared-context/SharedContext.js", () => ({
  sharedContextService: {
    getContext: vi.fn().mockResolvedValue(mockCycle.context),
    updateContext: vi.fn().mockResolvedValue(mockCycle.context),
    updateSubsystem: vi.fn().mockResolvedValue(mockCycle.context),
  },
}));

vi.mock("../../../bhudhi/integration/TorgimaIntegration.js", () => ({
  torgimaIntegration: {
    processTaskFeedback: vi.fn().mockResolvedValue({
      nextTaskRecommendation: { id: "r1", title: "Next", description: "d", reasoning: "r", confidence: 0.8 },
      signals: "power",
      insights: [],
      investigationCount: 1,
      recommendationCount: 1,
    }),
  },
}));

const blueprintRow = {
  id: BP,
  goal: "Launch coaching business",
  purpose: "Help clients execute",
  domain: "delivery",
  current_domain: "delivery",
  current_project_id: null,
  current_action_id: null,
  current_condition: "stability",
  user_id: "user-1",
  metadata: {},
  updated_at: new Date(),
};

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([blueprintRow]),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "order-new" }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  blueprints: {},
  orders: {},
}));

describe("BHUDHI Prompt 39 — Convergence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps signal to control via bridge", async () => {
    const { TorgimaBhudhiBridge } = await import("../../../bhudhi/convergence/TorgimaBhudhiBridge.js");
    const bridge = new TorgimaBhudhiBridge();
    expect(bridge.mapSignalToControl("danger")).toBe("recover");
    expect(bridge.mapSignalToControl("power")).toBe("scale");
    expect(bridge.mapSignalToCondition("urgency")).toBe("urgency");
  });

  it("executeGoal returns intelligence and proposed order", async () => {
    const { ConvergenceLayer } = await import("../../../bhudhi/convergence/ConvergenceLayer.js");
    const layer = new ConvergenceLayer();
    const result = await layer.executeGoal(BP, { createOrder: false });
    expect(result.intelligence.status).toBe("completed");
    expect(result.signal).toBe("power");
    expect(result.control).toBe("scale");
    expect(result.proposedOrder.instruction).toContain("Accelerate");
  });

  it("processFeedback runs integration and re-executes goal", async () => {
    const { ConvergenceLayer } = await import("../../../bhudhi/convergence/ConvergenceLayer.js");
    const { torgimaIntegration } = await import("../../../bhudhi/integration/TorgimaIntegration.js");
    const layer = new ConvergenceLayer();
    const result = await layer.processFeedback(BP, "order-1", { completed: true });
    expect(torgimaIntegration.processTaskFeedback).toHaveBeenCalled();
    expect(result.feedbackProcessed).toBe(true);
    expect(result.convergence.proposedOrder).toBeDefined();
  });
});
