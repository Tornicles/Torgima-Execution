import {
  db,
  bhudhiMemoryNodes,
  bhudhiMemoryEdges,
  bhudhiMemoryQueries,
  bhudhiMemoryTimeline,
  bhudhiMemoryRelationships,
} from "@workspace/db";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type {
  MemoryEdgeInput,
  MemoryNodeInput,
  MemoryQueryInput,
  MemoryQueryResult,
  MemoryStats,
} from "../contracts/types.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function toNodeRecord(row: typeof bhudhiMemoryNodes.$inferSelect) {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    nodeType: row.node_type,
    nodeId: row.node_id,
    content: row.content,
    summary: row.summary,
    sourceEngine: row.source_engine,
    sourceEvent: row.source_event,
    confidence: row.confidence,
    importance: row.importance,
    verified: row.verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MemoryGraph {
  async addNode(node: MemoryNodeInput) {
    const expiresAt = new Date(Date.now() + ONE_YEAR_MS);

    const [row] = await db
      .insert(bhudhiMemoryNodes)
      .values({
        blueprint_id: node.blueprintId,
        node_type: node.nodeType,
        node_id: node.nodeId,
        content: node.content,
        summary: node.summary,
        source_engine: node.sourceEngine,
        source_event: node.sourceEvent ?? null,
        confidence: node.confidence ?? 0.75,
        importance: node.importance ?? 0.5,
        verified: node.verified ?? false,
        expires_at: expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          bhudhiMemoryNodes.blueprint_id,
          bhudhiMemoryNodes.node_type,
          bhudhiMemoryNodes.node_id,
        ],
        set: {
          content: node.content,
          summary: node.summary,
          source_engine: node.sourceEngine,
          source_event: node.sourceEvent ?? null,
          confidence: node.confidence ?? 0.75,
          importance: node.importance ?? 0.5,
          verified: node.verified ?? false,
          updated_at: new Date(),
        },
      })
      .returning();

    await this.appendTimeline(node.blueprintId, row.id, `node.${node.nodeType}.upsert`, {
      nodeType: node.nodeType,
      nodeId: node.nodeId,
      summary: node.summary,
    });

    return toNodeRecord(row);
  }

  async addEdge(edge: MemoryEdgeInput) {
    const [row] = await db
      .insert(bhudhiMemoryEdges)
      .values({
        blueprint_id: edge.blueprintId,
        from_node_id: edge.fromNodeId,
        to_node_id: edge.toNodeId,
        edge_type: edge.edgeType,
        strength: edge.strength ?? 0.7,
        bidirectional: edge.bidirectional ?? false,
      })
      .onConflictDoUpdate({
        target: [
          bhudhiMemoryEdges.blueprint_id,
          bhudhiMemoryEdges.from_node_id,
          bhudhiMemoryEdges.to_node_id,
          bhudhiMemoryEdges.edge_type,
        ],
        set: {
          strength: edge.strength ?? 0.7,
          bidirectional: edge.bidirectional ?? false,
          updated_at: new Date(),
        },
      })
      .returning();

    if (edge.edgeType === "contradicts") {
      await db.insert(bhudhiMemoryRelationships).values({
        blueprint_id: edge.blueprintId,
        node_id_1: edge.fromNodeId,
        node_id_2: edge.toNodeId,
        relationship_type: "contradicts",
        strength: edge.strength ?? 0.7,
      });
    }

    return row;
  }

  async queryMemory(blueprintId: string, query: MemoryQueryInput): Promise<MemoryQueryResult> {
    const started = Date.now();
    const limit = Math.min(query.limit ?? 20, 100);

    const conditions = [eq(bhudhiMemoryNodes.blueprint_id, blueprintId)];
    if (query.nodeTypes?.length) {
      conditions.push(inArray(bhudhiMemoryNodes.node_type, query.nodeTypes));
    }

    const nodes = await db
      .select()
      .from(bhudhiMemoryNodes)
      .where(and(...conditions))
      .orderBy(desc(bhudhiMemoryNodes.importance), desc(bhudhiMemoryNodes.confidence))
      .limit(limit);

    const nodeIds = nodes.map((n) => n.id);
    const edges =
      nodeIds.length > 0
        ? await db
            .select()
            .from(bhudhiMemoryEdges)
            .where(
              and(
                eq(bhudhiMemoryEdges.blueprint_id, blueprintId),
                or(
                  inArray(bhudhiMemoryEdges.from_node_id, nodeIds),
                  inArray(bhudhiMemoryEdges.to_node_id, nodeIds),
                ),
              ),
            )
        : [];

    const executionTime = Date.now() - started;
    const results: MemoryQueryResult = {
      nodes: nodes.map(toNodeRecord),
      edges: edges.map((e) => ({
        id: e.id,
        fromNodeId: e.from_node_id,
        toNodeId: e.to_node_id,
        edgeType: e.edge_type,
        strength: e.strength,
      })),
    };

    await db.insert(bhudhiMemoryQueries).values({
      blueprint_id: blueprintId,
      query: query.query ?? "graph query",
      node_types: query.nodeTypes ?? [],
      filters: query.filters ?? {},
      results,
      result_count: nodes.length,
      execution_time_ms: executionTime,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    for (const n of nodes) {
      await db
        .update(bhudhiMemoryNodes)
        .set({
          access_count: (n.access_count ?? 0) + 1,
          last_access_at: new Date(),
        })
        .where(eq(bhudhiMemoryNodes.id, n.id));
    }

    return results;
  }

  async getRelated(blueprintId: string, nodeId: string) {
    const edges = await db
      .select()
      .from(bhudhiMemoryEdges)
      .where(
        and(
          eq(bhudhiMemoryEdges.blueprint_id, blueprintId),
          or(eq(bhudhiMemoryEdges.from_node_id, nodeId), eq(bhudhiMemoryEdges.to_node_id, nodeId)),
        ),
      );

    const relatedIds = edges.map((e) => (e.from_node_id === nodeId ? e.to_node_id : e.from_node_id));

    if (relatedIds.length === 0) return [];

    const related = await db
      .select()
      .from(bhudhiMemoryNodes)
      .where(inArray(bhudhiMemoryNodes.id, relatedIds));

    return related.map(toNodeRecord);
  }

  async findContradictions(blueprintId: string) {
    return db
      .select()
      .from(bhudhiMemoryRelationships)
      .where(
        and(
          eq(bhudhiMemoryRelationships.blueprint_id, blueprintId),
          eq(bhudhiMemoryRelationships.relationship_type, "contradicts"),
        ),
      );
  }

  async getTimeline(blueprintId: string, limit = 100) {
    return db
      .select()
      .from(bhudhiMemoryTimeline)
      .where(eq(bhudhiMemoryTimeline.blueprint_id, blueprintId))
      .orderBy(desc(bhudhiMemoryTimeline.timestamp))
      .limit(limit);
  }

  async consolidate(blueprintId: string) {
    const nodes = await db
      .select()
      .from(bhudhiMemoryNodes)
      .where(eq(bhudhiMemoryNodes.blueprint_id, blueprintId));

    const consolidated: Record<string, Array<ReturnType<typeof toNodeRecord>>> = {};

    for (const node of nodes) {
      const rec = toNodeRecord(node);
      if (!consolidated[node.node_type]) consolidated[node.node_type] = [];
      consolidated[node.node_type].push(rec);
    }

    await this.appendTimeline(blueprintId, null, "memory.consolidate", {
      types: Object.keys(consolidated),
      total: nodes.length,
    });

    return consolidated;
  }

  async cleanupExpired(blueprintId: string) {
    const deleted = await db
      .delete(bhudhiMemoryNodes)
      .where(
        and(
          eq(bhudhiMemoryNodes.blueprint_id, blueprintId),
          lt(bhudhiMemoryNodes.expires_at, new Date()),
        ),
      )
      .returning({ id: bhudhiMemoryNodes.id });

    return deleted.length;
  }

  async getStats(blueprintId: string): Promise<MemoryStats> {
    const nodes = await db
      .select({ node_type: bhudhiMemoryNodes.node_type })
      .from(bhudhiMemoryNodes)
      .where(eq(bhudhiMemoryNodes.blueprint_id, blueprintId));

    const edgeCountRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bhudhiMemoryEdges)
      .where(eq(bhudhiMemoryEdges.blueprint_id, blueprintId));

    const nodesByType: Record<string, number> = {};
    for (const n of nodes) {
      nodesByType[n.node_type] = (nodesByType[n.node_type] ?? 0) + 1;
    }

    return {
      totalNodes: nodes.length,
      totalEdges: Number(edgeCountRows[0]?.count ?? 0),
      nodesByType,
    };
  }

  /** Build context string for BhudhiCore from highest-importance nodes. */
  async queryForContext(blueprintId: string, limit = 8): Promise<string> {
    const { nodes } = await this.queryMemory(blueprintId, { limit, query: "context" });
    if (nodes.length === 0) return "";
    return nodes.map((n) => `${n.nodeType}: ${n.summary}`).join(" | ").slice(0, 800);
  }

  private async appendTimeline(
    blueprintId: string,
    nodeId: string | null,
    event: string,
    state: Record<string, unknown>,
  ) {
    await db.insert(bhudhiMemoryTimeline).values({
      blueprint_id: blueprintId,
      node_id: nodeId,
      event,
      state,
      timestamp: new Date(),
    });
  }
}

export const memoryGraph = new MemoryGraph();
