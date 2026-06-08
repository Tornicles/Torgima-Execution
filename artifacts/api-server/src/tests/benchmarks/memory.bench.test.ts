import { describe, it, expect, vi } from "vitest";
import { benchScale, percentile } from "./benchScale.js";

const BP = "00000000-0000-4000-8000-00000000b038m";

const nodes: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const T = { nodes: Symbol("nodes"), edges: Symbol("edges"), timeline: Symbol("timeline"), queries: Symbol("queries") };
  const empty = (data: unknown[] = []) => {
    const p = Promise.resolve(data) as Promise<unknown[]> & { orderBy: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> };
    p.orderBy = vi.fn(() => ({ limit: vi.fn().mockResolvedValue(data) }));
    p.limit = vi.fn().mockResolvedValue(data);
    return p;
  };
  const row = (v: Record<string, unknown>) => ({
    id: `n-${nodes.length}`,
    blueprint_id: v.blueprint_id,
    node_type: v.node_type,
    node_id: v.node_id,
    content: v.content ?? {},
    summary: v.summary ?? "",
    source_engine: v.source_engine ?? "test",
    confidence: 0.75,
    importance: 0.5,
    verified: false,
    created_at: new Date(),
    updated_at: new Date(),
  });
  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((v: Record<string, unknown>) => {
          const r = row(v);
          nodes.push(r);
          return {
            onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([r]) })),
            returning: vi.fn().mockResolvedValue([r]),
          };
        }),
      })),
      select: vi.fn(() => ({
        from: vi.fn((table: symbol) => {
          if (table === T.edges) {
            return { where: vi.fn(() => Promise.resolve([])) };
          }
          return {
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue(nodes.filter((n) => n.blueprint_id === BP).slice(0, 50)),
              })),
            })),
            orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(nodes.slice(0, 50)) })),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      })),
    },
    bhudhiMemoryNodes: T.nodes,
    bhudhiMemoryTimeline: T.timeline,
    bhudhiMemoryQueries: T.queries,
    bhudhiMemoryEdges: T.edges,
    bhudhiMemoryRelationships: {},
  };
});

describe("BHUDHI Prompt 38 — Memory benchmarks", () => {
  it("ingests benchmark node volume", async () => {
    const nodeCount = benchScale(10_000, 200);
    const { MemoryGraph } = await import("../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    const start = Date.now();
    for (let i = 0; i < nodeCount; i++) {
      await graph.addNode({
        blueprintId: BP,
        nodeType: "belief",
        nodeId: `belief_${i}`,
        content: { index: i },
        summary: `Belief ${i}`,
        sourceEngine: "benchmark",
      });
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(nodeCount * 10);
  });

  it("queries memory graph with p99 < 50ms (mocked)", async () => {
    const { MemoryGraph } = await import("../../bhudhi/kernel/memory/memory-graph/MemoryGraph.js");
    const graph = new MemoryGraph();
    const queryCount = benchScale(100, 30);
    const latencies: number[] = [];
    for (let i = 0; i < queryCount; i++) {
      const start = Date.now();
      await graph.queryMemory(BP, { nodeTypes: ["belief"], limit: 20 });
      latencies.push(Date.now() - start);
    }
    latencies.sort((a, b) => a - b);
    expect(percentile(latencies, 0.99)).toBeLessThanOrEqual(50);
  });
});
