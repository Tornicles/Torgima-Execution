import { describe, it, expect, vi, beforeEach } from "vitest";

const { TEST_BLUEPRINT_ID } = vi.hoisted(() => ({
  TEST_BLUEPRINT_ID: "00000000-0000-4000-8000-000000000032",
}));

const nodesStore: Array<Record<string, unknown>> = [];
const edgesStore: Array<Record<string, unknown>> = [];
const timelineStore: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const T = {
    nodes: Symbol("nodes"),
    edges: Symbol("edges"),
    timeline: Symbol("timeline"),
    queries: Symbol("queries"),
    relationships: Symbol("relationships"),
    signals: Symbol("signals"),
    investigations: Symbol("investigations"),
    recommendations: Symbol("recommendations"),
    framework: Symbol("framework"),
    kernelEvents: Symbol("kernelEvents"),
    sharedContext: Symbol("sharedContext"),
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

  const makeRow = (vals: Record<string, unknown>) => ({
    id: `id-${nodesStore.length}`,
    blueprint_id: vals.blueprint_id,
    node_type: vals.node_type,
    node_id: vals.node_id,
    content: vals.content ?? {},
    summary: vals.summary ?? "",
    source_engine: vals.source_engine ?? "",
    source_event: vals.source_event ?? null,
    confidence: vals.confidence ?? 0.75,
    importance: vals.importance ?? 0.5,
    verified: false,
    access_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...vals,
  });

  function rowsForTable(table: symbol, projection?: Record<string, unknown>) {
    if (projection && "count" in projection) {
      return [{ count: edgesStore.length }];
    }
    if (table === T.edges) return [...edgesStore];
    if (table === T.nodes) {
      if (projection && "node_type" in projection) {
        return nodesStore.map((n) => ({ node_type: n.node_type }));
      }
      return [...nodesStore];
    }
    return [];
  }

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          if (vals.event && vals.state) {
            timelineStore.push(vals);
            return Promise.resolve(undefined);
          }
          if (vals.from_node_id) {
            const row = { id: `edge-${edgesStore.length}`, ...vals };
            edgesStore.push(row);
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([row]),
              })),
            };
          }
          if (vals.node_type) {
            const row = makeRow(vals);
            nodesStore.push(row);
            return {
              onConflictDoUpdate: vi.fn(() => ({
                returning: vi.fn().mockResolvedValue([row]),
              })),
            };
          }
          return Promise.resolve(undefined);
        }),
      })),
      select: vi.fn((projection?: Record<string, unknown>) => ({
        from: vi.fn((table: symbol) => ({
          where: vi.fn(() => emptyQueryResult(rowsForTable(table, projection))),
          orderBy: vi.fn(() => emptyQueryResult(rowsForTable(table, projection))),
          limit: vi.fn().mockResolvedValue(rowsForTable(table, projection)),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    },
    bhudhiMemoryNodes: T.nodes,
    bhudhiMemoryEdges: T.edges,
    bhudhiMemoryQueries: T.queries,
    bhudhiMemoryTimeline: T.timeline,
    bhudhiMemoryRelationships: T.relationships,
    bhudhiSignals: T.signals,
    bhudhiInvestigations: T.investigations,
    bhudhiRecommendations: T.recommendations,
    bhudhiFrameworkLearning: T.framework,
    bhudhiKernelEvents: T.kernelEvents,
    bhudhiSharedContext: T.sharedContext,
  };
});

describe("BHUDHI PROMPT 32 — MemoryGraph", () => {
  beforeEach(() => {
    nodesStore.length = 0;
    edgesStore.length = 0;
    timelineStore.length = 0;
  });

  it("adds memory nodes", async () => {
    const { MemoryGraph } = await import("../../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    const node = await graph.addNode({
      blueprintId: TEST_BLUEPRINT_ID,
      nodeType: "belief",
      nodeId: "b1",
      content: { text: "Ship fast" },
      summary: "Belief: ship fast",
      sourceEngine: "belief-engine",
    });
    expect(node.nodeType).toBe("belief");
    expect(node.summary).toContain("Belief");
  });

  it("queries memory graph", async () => {
    const { MemoryGraph } = await import("../../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    await graph.addNode({
      blueprintId: TEST_BLUEPRINT_ID,
      nodeType: "decision",
      nodeId: "d1",
      content: {},
      summary: "Decision one",
      sourceEngine: "decision",
    });
    const result = await graph.queryMemory(TEST_BLUEPRINT_ID, { nodeTypes: ["decision"], limit: 10 });
    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it("returns stats by type", async () => {
    const { MemoryGraph } = await import("../../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    await graph.addNode({
      blueprintId: TEST_BLUEPRINT_ID,
      nodeType: "signal",
      nodeId: "s1",
      content: {},
      summary: "Signal",
      sourceEngine: "signal",
    });
    const stats = await graph.getStats(TEST_BLUEPRINT_ID);
    expect(stats.totalNodes).toBeGreaterThanOrEqual(1);
    expect(stats.nodesByType.signal).toBe(1);
  });

  it("consolidates by node type", async () => {
    const { MemoryGraph } = await import("../../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    await graph.addNode({
      blueprintId: TEST_BLUEPRINT_ID,
      nodeType: "belief",
      nodeId: "b2",
      content: {},
      summary: "Belief two",
      sourceEngine: "belief-engine",
    });
    const consolidated = await graph.consolidate(TEST_BLUEPRINT_ID);
    expect(consolidated.belief?.length).toBe(1);
  });
});

describe("BHUDHI PROMPT 32 — MemoryAdapter", () => {
  it("migrateAll returns success structure", async () => {
    const { MemoryAdapter } = await import("../../../bhudhi/kernel/memory/memory-adapter/MemoryAdapter.js");
    const { MemoryGraph } = await import("../../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const adapter = new MemoryAdapter(new MemoryGraph());
    const result = await adapter.migrateAll(TEST_BLUEPRINT_ID);
    expect(result.success).toBe(true);
    expect(result.counts).toBeDefined();
  });
});
