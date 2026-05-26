export type ExpansionLevel = "LOCAL" | "SYSTEM" | "GLOBAL" | "LOCKED";
export type ExpansionStatus = "candidate" | "evaluated" | "promoted" | "rejected" | "rolled_back";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type EvalAction = "promote" | "repeat" | "reject" | "rollback";

export interface ExpansionInput {
  blueprintId: string;
  world?: Record<string, unknown>;
  decisions?: Record<string, unknown>;
  beliefs?: Record<string, unknown>;
  experiments?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  results?: Record<string, unknown>;
  constraints?: string[];
  seed?: string;
  governanceApproved?: boolean;
  capabilityId?: string;
}

export interface DiscoveredCapability {
  capability: string;
  origin: string;
  score: number;
  capabilityId?: string;
}

export interface ExpansionOutput {
  sessionId: string;
  newCapabilities: DiscoveredCapability[];
  confidence: number;
  risk: number;
  approval: boolean;
  recommendation: string;
  evaluation?: EvaluationResult;
  benchmark?: BenchmarkResult;
  level?: ExpansionLevel;
}

export interface EvaluationResult {
  performance: number;
  risk: number;
  reliability: number;
  cost: number;
  drift: number;
  action: EvalAction;
}

export interface ComposedCapability {
  newCapability: string;
  dependencies: string[];
}

export interface BenchmarkResult {
  gain: number;
  cost: number;
  confidence: number;
}

export interface TransferResult {
  domain: string;
  preserved: boolean;
  transferred: string[];
}

export interface AbstractionResult {
  generalKnowledge: string[];
  evidenceCount: number;
}
