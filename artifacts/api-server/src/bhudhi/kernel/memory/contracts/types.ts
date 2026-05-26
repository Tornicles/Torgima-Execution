export type MemoryNodeType =
  | "belief"
  | "decision"
  | "identity"
  | "team"
  | "world"
  | "signal"
  | "execution"
  | "learning"
  | "event"
  | "investigation"
  | "recommendation"
  | "governance";

export type MemoryEdgeType =
  | "depends_on"
  | "influences"
  | "contradicts"
  | "supports"
  | "evolves_to"
  | "similar_to";

export interface MemoryNodeInput {
  blueprintId: string;
  nodeType: string;
  nodeId: string;
  content: Record<string, unknown>;
  summary: string;
  sourceEngine: string;
  sourceEvent?: string;
  confidence?: number;
  importance?: number;
  verified?: boolean;
}

export interface MemoryEdgeInput {
  blueprintId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  strength?: number;
  bidirectional?: boolean;
}

export interface MemoryQueryInput {
  query?: string;
  nodeTypes?: string[];
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface MemoryQueryResult {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

export interface MemoryStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
}
