import { memoryGraph } from "./memory-graph/MemoryGraph.js";
import type { SharedContextRecord } from "../contracts/types.js";

/** Persist kernel cycle outputs into the unified memory graph. */
export async function syncCycleToMemoryGraph(
  blueprintId: string,
  context: SharedContextRecord,
  chainId: string,
): Promise<void> {
  const ctxNode = await memoryGraph.addNode({
    blueprintId,
    nodeType: "world",
    nodeId: `cycle-${chainId}`,
    content: {
      domain: context.domain,
      phase: context.phase,
      strategy: context.strategy,
      execution: context.execution,
      investigations: context.investigations,
      knowledge: context.knowledge,
    },
    summary: `Cycle ${chainId}: ${context.domain} · ${context.phase}`,
    sourceEngine: "kernel",
    sourceEvent: chainId,
    importance: 0.85,
  });

  const inv = context.investigations as { items?: Array<{ id: string; subject?: string }> };
  if (Array.isArray(inv?.items)) {
    for (const item of inv.items.slice(0, 10)) {
      const child = await memoryGraph.addNode({
        blueprintId,
        nodeType: "investigation",
        nodeId: item.id,
        content: item as Record<string, unknown>,
        summary: `Investigation: ${item.subject ?? item.id}`,
        sourceEngine: "investigation",
        sourceEvent: chainId,
      });
      await memoryGraph.addEdge({
        blueprintId,
        fromNodeId: ctxNode.id,
        toNodeId: child.id,
        edgeType: "supports",
        strength: 0.6,
      });
    }
  }

  const strategy = context.strategy as { recommendation?: { id?: string; title?: string } };
  if (strategy?.recommendation?.id) {
    const recNode = await memoryGraph.addNode({
      blueprintId,
      nodeType: "decision",
      nodeId: strategy.recommendation.id,
      content: strategy.recommendation as Record<string, unknown>,
      summary: `Decision: ${strategy.recommendation.title ?? "recommendation"}`,
      sourceEngine: "intelligence",
      sourceEvent: chainId,
      importance: 0.9,
    });
    await memoryGraph.addEdge({
      blueprintId,
      fromNodeId: ctxNode.id,
      toNodeId: recNode.id,
      edgeType: "influences",
      strength: 0.8,
    });
  }
}
