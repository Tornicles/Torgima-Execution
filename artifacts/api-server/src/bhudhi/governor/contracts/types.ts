export type PriorityLevel = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "BACKGROUND";
export type ArbitrationVerdict = "approve" | "delay" | "merge" | "escalate";
export type RecoveryMode = "soft" | "adaptive" | "rollback" | "full";
export type InterruptionAction = "pause" | "slow" | "freeze" | "reroute";
export type OrchestratorAction = "activate" | "pause" | "queue" | "resume" | "terminate";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";

export interface GovernorInput {
  blueprintId: string;
  world?: Record<string, unknown>;
  beliefs?: Record<string, unknown>;
  decisions?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  economics?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  time?: Record<string, unknown>;
  constraints?: string[];
  subsystems?: string[];
}

export interface PriorityEntry {
  subsystem: string;
  priority: PriorityLevel;
  score: number;
  reason: string;
}

export interface PriorityMap {
  entries: PriorityEntry[];
  topPriority: PriorityEntry;
}

export interface AllocationResult {
  allocation: Record<string, number>;
  waste: number;
  recommendation: string;
}

export interface Intervention {
  type: InterruptionAction | OrchestratorAction;
  subsystem: string;
  reason: string;
  severity: number;
}

export interface ExecutionPlan {
  sequence: string[];
  blocked: string[];
  escalations: string[];
  note: string;
}

export interface GovernorOutput {
  sessionId: string;
  priorityMap: PriorityMap;
  allocation: AllocationResult;
  interventions: Intervention[];
  executionPlan: ExecutionPlan;
  health?: SystemHealth;
  arbitration?: ArbitrationResult[];
}

export interface SystemHealth {
  quality: number;
  drift: number;
  latencyMs: number;
  coordination: number;
  efficiency: number;
  systemHealth: "healthy" | "degraded" | "critical" | "stable";
}

export interface ArbitrationResult {
  conflict: string;
  verdict: ArbitrationVerdict;
  reason: string;
}

export interface RecoveryResult {
  mode: RecoveryMode;
  target: string;
  status: "pending" | "in_progress" | "complete";
  preservedHistory: boolean;
  steps: string[];
}
