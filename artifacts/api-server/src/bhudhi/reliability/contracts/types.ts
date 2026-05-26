export type IncidentSeverity = "INFO" | "WARNING" | "MAJOR" | "CRITICAL" | "SYSTEM";
export type ChaosMode = "SAFE" | "LAB" | "STAGING" | "DISABLED";
export type RollbackMode = "SOFT" | "HARD" | "PARTIAL" | "SNAPSHOT";
export type RollbackTarget = "memory" | "state" | "execution" | "configuration" | "deployment";
export type ContainmentAction = "isolate" | "degrade" | "reroute" | "freeze" | "throttle";
export type ContinuityMode = "ONLINE" | "DEGRADED" | "OFFLINE" | "RECOVERY";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type RetentionWindow = "7d" | "30d" | "90d" | "1y";

export interface ReliabilityInput {
  blueprintId: string;
  execution?: Record<string, unknown>;
  world?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  economics?: Record<string, unknown>;
  memory?: Record<string, unknown> | string;
  simulation?: Record<string, unknown>;
  governance?: Record<string, unknown>;
  constraints?: string[];
  chaosMode?: ChaosMode;
  governanceApproved?: boolean;
}

export interface ReliabilityOutput {
  sessionId: string;
  health: number;
  risk: number;
  failureProbability: number;
  recommendedProtection: string;
  resilienceScore?: number;
  continuityMode?: ContinuityMode;
  incidents?: DetectedIncident[];
  containment?: ContainmentResult[];
}

export interface DetectedIncident {
  incident: string;
  severity: IncidentSeverity;
  confidence: number;
}

export interface ContainmentResult {
  action: ContainmentAction;
  target: string;
  reason: string;
}

export interface RecoveryOutput {
  strategy: string;
  confidence: number;
  estimatedRecovery: number;
}

export interface RollbackResult {
  target: RollbackTarget;
  mode: RollbackMode;
  preservedHistory: boolean;
  status: "pending" | "complete";
  steps: string[];
}

export interface IncidentRecord {
  incidentId: string;
  owner: string;
  sla: number;
  status: "open" | "contained" | "recovering" | "closed";
}

export interface ObservatorySnapshot {
  latencyMs: number;
  incidentCount: number;
  availability: number;
  drift: number;
  rollbackCount: number;
  errorRate: number;
  retention: RetentionWindow;
}
