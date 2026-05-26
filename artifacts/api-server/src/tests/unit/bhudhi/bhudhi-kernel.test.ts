import { describe, it, expect, vi, beforeEach } from "vitest";

const { TEST_BLUEPRINT_ID } = vi.hoisted(() => ({
  TEST_BLUEPRINT_ID: "00000000-0000-4000-8000-000000000031",
}));

const investigateBlueprint = vi.fn().mockResolvedValue([{ id: "inv1", findings: {} }]);
const analyzeAndRecommend = vi.fn().mockResolvedValue([
  { id: "rec1", blueprintId: "bp", title: "Test", confidence: 0.8 },
]);
const validateRecommendation = vi.fn().mockResolvedValue({ valid: true, violations: [] });
const approveRecommendation = vi.fn().mockResolvedValue({});
const executeRecommendation = vi.fn().mockResolvedValue({ success: true });
const consolidateKnowledge = vi.fn().mockResolvedValue({ frameworksImproved: {} });

vi.mock("../../../bhudhi/investigation/InvestigationService.js", () => ({
  investigationService: { investigateBlueprint },
}));

vi.mock("../../../bhudhi/intelligence/IntelligenceService.js", () => ({
  intelligenceService: { analyzeAndRecommend },
}));

vi.mock("../../../bhudhi/security/SecurityService.js", () => ({
  securityService: { validateRecommendation },
}));

vi.mock("../../../bhudhi/operating/operatingData.js", () => ({
  approveRecommendation,
}));

vi.mock("../../../bhudhi/operating/OperatingService.js", () => ({
  operatingService: { executeRecommendation },
}));

vi.mock("../../../bhudhi/preservation/PreservationService.js", () => ({
  preservationService: { consolidateKnowledge },
}));

vi.mock("@workspace/db", () => {
  const store = {
    events: [] as Array<Record<string, unknown>>,
    contexts: new Map<string, Record<string, unknown>>(),
    registry: [] as Array<Record<string, unknown>>,
    contracts: [] as Array<Record<string, unknown>>,
  };

  function emptyQueryResult(data: unknown[] = []) {
    const promise = Promise.resolve(data) as Promise<unknown[]> & {
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    promise.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(data) }));
    promise.limit = vi.fn().mockResolvedValue(data);
    return promise;
  }

  const defaultContext = {
    id: "ctx-1",
    blueprint_id: TEST_BLUEPRINT_ID,
    domain: "genesis",
    phase: "initiation",
    signal: "nothingness",
    condition: "nothingness",
    context: {},
    ideas: {},
    strategy: {},
    predictions: {},
    knowledge: {},
    behavior: {},
    execution: {},
    investigations: {},
    last_update_engine: "system",
    last_update_time: new Date(),
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };
  store.contexts.set(TEST_BLUEPRINT_ID, defaultContext);

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          const where = vi.fn(() => {
            if (String(table).includes("Shared") || String(table).includes("shared")) {
              return emptyQueryResult([store.contexts.get(TEST_BLUEPRINT_ID) ?? defaultContext]);
            }
            if (String(table).includes("Registry") || String(table).includes("registry")) {
              return emptyQueryResult(store.registry);
            }
            return emptyQueryResult(store.events);
          });
          return {
            where,
            orderBy: vi.fn(() => emptyQueryResult(store.events)),
            limit: vi.fn().mockImplementation(() => {
              if (String(table).includes("Shared")) {
                return Promise.resolve([store.contexts.get(TEST_BLUEPRINT_ID) ?? defaultContext]);
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          if (String(table).includes("kernel_events") || vals.event_type) {
            const row = { id: `evt-${store.events.length}`, ...vals, created_at: new Date(), updated_at: new Date() };
            store.events.push(row);
            return { returning: vi.fn().mockResolvedValue([row]) };
          }
          if (vals.blueprint_id && vals.domain !== undefined) {
            store.contexts.set(vals.blueprint_id as string, { id: "ctx-1", version: 1, ...vals });
            return { returning: vi.fn().mockResolvedValue([store.contexts.get(vals.blueprint_id as string)]) };
          }
          if (vals.engine_id) {
            store.registry.push(vals);
            return { returning: vi.fn().mockResolvedValue([vals]) };
          }
          store.contracts.push(vals);
          return { returning: vi.fn().mockResolvedValue([{ id: "contract-1", ...vals }]) };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => {
          const ctx = { ...defaultContext, ...vals, version: 2, blueprint_id: TEST_BLUEPRINT_ID };
          store.contexts.set(TEST_BLUEPRINT_ID, ctx);
          return {
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([ctx]),
            })),
          };
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
      })),
    },
    bhudhiKernelEvents: { id: "id", blueprint_id: "blueprint_id", chain_id: "chain_id", created_at: "created_at" },
    bhudhiSharedContext: { blueprint_id: "blueprint_id" },
    bhudhiEngineRegistry: { engine_id: "engine_id" },
    bhudhiExecutionContracts: { id: "id" },
  };
});

describe("BHUDHI PROMPT 31 — SharedContext", () => {
  it("validates genesis nothingness consistency", async () => {
    const { sharedContextService } = await import("../../../bhudhi/kernel/shared-context/SharedContext.js");
    const v = await sharedContextService.validateContext(TEST_BLUEPRINT_ID);
    expect(v.valid).toBe(true);
  });
});

describe("BHUDHI PROMPT 31 — EventBus", () => {
  it("publishes and returns event id", async () => {
    const { EventBus } = await import("../../../bhudhi/kernel/event-bus/EventBus.js");
    const bus = new EventBus();
    const id = await bus.publish({
      blueprintId: TEST_BLUEPRINT_ID,
      eventType: "test.event",
      sourceEngine: "test",
      payload: { ok: true },
    });
    expect(id).toBeTruthy();
  });
});

describe("BHUDHI PROMPT 31 — CognitiveKernel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateRecommendation.mockResolvedValue({ valid: true, violations: [] });
  });

  it("runs unified cycle through all systems", async () => {
    const { CognitiveKernel } = await import("../../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js");
    const kernel = new CognitiveKernel();
    const result = await kernel.runCycle(TEST_BLUEPRINT_ID);

    expect(investigateBlueprint).toHaveBeenCalledWith(TEST_BLUEPRINT_ID);
    expect(analyzeAndRecommend).toHaveBeenCalledWith(TEST_BLUEPRINT_ID);
    expect(validateRecommendation).toHaveBeenCalled();
    expect(consolidateKnowledge).toHaveBeenCalledWith(TEST_BLUEPRINT_ID);
    expect(result.chainId).toMatch(/^cycle_/);
    expect(result.status).toBe("completed");
    expect(result.eventIds.length).toBeGreaterThan(0);
  });

  it("skips operating when security rejects", async () => {
    validateRecommendation.mockResolvedValue({ valid: false, violations: ["blocked"] });

    const { CognitiveKernel } = await import("../../../bhudhi/kernel/cognitive-kernel/CognitiveKernel.js");
    const kernel = new CognitiveKernel();
    await kernel.runCycle(TEST_BLUEPRINT_ID);

    expect(executeRecommendation).not.toHaveBeenCalled();
  });
});
