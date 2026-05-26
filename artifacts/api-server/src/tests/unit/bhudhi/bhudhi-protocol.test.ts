import { describe, it, expect, vi, beforeEach } from "vitest";

const { TEST_BLUEPRINT_ID } = vi.hoisted(() => ({
  TEST_BLUEPRINT_ID: "00000000-0000-4000-8000-000000000033",
}));

const messagesStore: Array<Record<string, unknown>> = [];
const routesStore: Array<Record<string, unknown>> = [];
const contractsStore: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const T = {
    messages: Symbol("messages"),
    routes: Symbol("routes"),
    contracts: Symbol("contracts"),
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

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          if (vals.pattern) {
            const row = { id: `route-${routesStore.length}`, ...vals };
            routesStore.push(row);
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([row]),
              })),
            };
          }
          if (vals.engine_a) {
            contractsStore.push({ id: `contract-${contractsStore.length}`, ...vals });
            return {
              onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
            };
          }
          const row = {
            id: `msg-${messagesStore.length}`,
            sent_at: new Date(),
            processed_at: null,
            latency_ms: null,
            status: "sent",
            ...vals,
          };
          messagesStore.push(row);
          return { returning: vi.fn().mockResolvedValue([row]) };
        }),
      })),
      select: vi.fn((projection?: Record<string, unknown>) => ({
        from: vi.fn((table: symbol) => ({
          where: vi.fn(() => {
            if (projection && "maxSeq" in projection) {
              const max = messagesStore.reduce(
                (m, r) => Math.max(m, Number(r.sequence_number ?? 0)),
                0,
              );
              return emptyQueryResult([{ maxSeq: max }]);
            }
            if (table === T.routes) return emptyQueryResult([...routesStore]);
            if (table === T.contracts) return emptyQueryResult([...contractsStore]);
            return emptyQueryResult([...messagesStore]);
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([...messagesStore]),
          })),
          limit: vi.fn().mockImplementation(() => {
            if (table === T.routes && routesStore.length) {
              return Promise.resolve([routesStore[routesStore.length - 1]]);
            }
            if (table === T.messages && messagesStore.length) {
              return Promise.resolve([messagesStore[messagesStore.length - 1]]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((vals: Record<string, unknown>) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              const last = messagesStore[messagesStore.length - 1];
              if (last) Object.assign(last, vals);
              return Promise.resolve(last ? [last] : []);
            }),
          })),
        })),
      })),
    },
    bhudhiProtocolMessages: T.messages,
    bhudhiProtocolRoutes: T.routes,
    bhudhiProtocolContracts: T.contracts,
  };
});

vi.mock("../../../bhudhi/investigation/InvestigationService.js", () => ({
  investigationService: { investigateBlueprint: vi.fn().mockResolvedValue([{ id: "inv1" }]) },
}));
vi.mock("../../../bhudhi/intelligence/IntelligenceService.js", () => ({
  intelligenceService: { analyzeAndRecommend: vi.fn().mockResolvedValue([{ id: "rec1", title: "T" }]) },
}));
vi.mock("../../../bhudhi/security/SecurityService.js", () => ({
  securityService: {
    validateRecommendation: vi.fn().mockResolvedValue({ valid: true, violations: [] }),
  },
}));
vi.mock("../../../bhudhi/operating/OperatingService.js", () => ({
  operatingService: { executeRecommendation: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("../../../bhudhi/preservation/PreservationService.js", () => ({
  preservationService: { consolidateKnowledge: vi.fn().mockResolvedValue({ frameworksImproved: {} }) },
}));
vi.mock("../../../bhudhi/kernel/event-bus/EventBus.js", () => ({
  eventBus: { publish: vi.fn().mockResolvedValue("evt-1") },
  EventBus: vi.fn(),
}));

describe("BHUDHI PROMPT 33 — BhudhiProtocol", () => {
  beforeEach(() => {
    messagesStore.length = 0;
    routesStore.length = 0;
    contractsStore.length = 0;
  });

  it("parses BHUDHI:// URIs", async () => {
    const { BhudhiProtocol } = await import("../../../bhudhi/protocol/BhudhiProtocol.js");
    const protocol = new BhudhiProtocol();
    const parsed = protocol.parseUri("bhudhi://investigation/complete?blueprintId=abc");
    expect(parsed.system).toBe("investigation");
    expect(parsed.action).toBe("complete");
    expect(parsed.params.blueprintId).toBe("abc");
  });

  it("sends and stores protocol messages", async () => {
    const { BhudhiProtocol } = await import("../../../bhudhi/protocol/BhudhiProtocol.js");
    const protocol = new BhudhiProtocol();
    const message = protocol.createMessage(
      "investigation",
      "intelligence",
      "bhudhi://investigation/complete",
      { ok: true },
    );
    const id = await protocol.send(TEST_BLUEPRINT_ID, message);
    expect(id).toBeTruthy();
    expect(messagesStore.length).toBe(1);
  });

  it("returns message history", async () => {
    const { BhudhiProtocol } = await import("../../../bhudhi/protocol/BhudhiProtocol.js");
    const protocol = new BhudhiProtocol();
    await protocol.send(
      TEST_BLUEPRINT_ID,
      protocol.createMessage("a", "b", "bhudhi://investigation/complete", {}),
    );
    const history = await protocol.getHistory(TEST_BLUEPRINT_ID);
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it("creates engine contracts", async () => {
    const { BhudhiProtocol } = await import("../../../bhudhi/protocol/BhudhiProtocol.js");
    const protocol = new BhudhiProtocol();
    await protocol.createContract("investigation", "intelligence", ["complete"], ["delivery"]);
    const has = await protocol.hasContract("investigation", "intelligence");
    expect(has).toBe(true);
  });
});

describe("BHUDHI PROMPT 33 — ProtocolRouter", () => {
  beforeEach(() => {
    messagesStore.length = 0;
    routesStore.length = 0;
    contractsStore.length = 0;
    vi.clearAllMocks();
  });

  it("routes investigation messages", async () => {
    const { BhudhiProtocol } = await import("../../../bhudhi/protocol/BhudhiProtocol.js");
    const { ProtocolRouter } = await import("../../../bhudhi/protocol/ProtocolRouter.js");
    const protocol = new BhudhiProtocol();
    const router = new ProtocolRouter(protocol);

    const { messageId } = await router.sendAndRoute(
      TEST_BLUEPRINT_ID,
      "investigation",
      "intelligence",
      "bhudhi://investigation/complete",
      { blueprintId: TEST_BLUEPRINT_ID },
    );

    expect(messageId).toBeTruthy();
    const last = messagesStore[messagesStore.length - 1] as Record<string, unknown>;
    expect(last.status).toBe("processed");
  });
});

describe("BHUDHI PROMPT 33 — examples", () => {
  it("exports standard protocol examples", async () => {
    const { PROTOCOL_EXAMPLES } = await import("../../../bhudhi/protocol/examples.js");
    expect(PROTOCOL_EXAMPLES.investigationComplete.uri).toBe("bhudhi://investigation/complete");
    expect(PROTOCOL_EXAMPLES.preservationLearn.from).toBe("preservation");
  });
});
