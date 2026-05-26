export type EntityType =
  | "USER"
  | "GOAL"
  | "PROJECT"
  | "TASK"
  | "TEAM"
  | "RESOURCE"
  | "EVENT"
  | "RISK"
  | "SYSTEM"
  | "AGENT";

export type StateKind = "STATIC" | "DYNAMIC" | "VOLATILE" | "LOCKED";
export type RelationType = "depends_on" | "influences" | "blocks" | "supports" | "conflicts" | "inherits";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type SyncMode = "live" | "scheduled" | "manual";

export interface WorldEntity {
  entityId: string;
  type: EntityType;
  label: string;
  state: Record<string, unknown>;
  relationships: string[];
  history: Array<{ at: string; change: string }>;
}

export interface WorldRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  weight: number;
}

export interface StateDelta {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  delta: Record<string, unknown>;
}

export interface CauseNode {
  cause: string;
  confidence: number;
  impact: number;
  children?: CauseNode[];
}

export interface CounterfactualScenario {
  scenario: string;
  probability: number;
  impact: number;
}

export interface WorldInput {
  blueprintId: string;
  userId?: string;
  trigger?: string;
  memory?: string | Record<string, unknown>;
  signals?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  life?: Record<string, unknown>;
  simulation?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  constraints?: string[];
}

export interface WorldState {
  sessionId: string;
  version: number;
  entities: WorldEntity[];
  relationships: WorldRelationship[];
  events: Array<{ eventId: string; type: string; cause?: string; impact: number }>;
  constraints: ConstraintResult;
  timeline: { past: number; current: number; future: number };
}

export interface ConstraintResult {
  allowed: boolean;
  blocked: string[];
  why: string;
}

export interface WorldOutput {
  worldState: WorldState;
  confidence: number;
  changes: string[];
  prediction?: { next: string; confidence: number };
  sync?: { drift: boolean; stale: boolean; conflicts: number };
}

export interface WorldBranchInput {
  blueprintId: string;
  branchFromSnapshotId?: string;
  scenario: string;
}
