export type BeliefState =
  | "OBSERVED"
  | "INFERRED"
  | "ASSUMED"
  | "HYPOTHESIZED"
  | "VALIDATED"
  | "DEPRECATED"
  | "REJECTED";

export type BeliefKind = "fact" | "belief" | "assumption" | "hypothesis";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "EXPIRED" | "SEALED";
export type TruthCategory = "LOCAL" | "GLOBAL" | "TEMPORARY" | "PERMANENT";
export type EvidenceSource = "memory" | "research" | "execution" | "simulation" | "feedback" | "life";

export interface BeliefRecord {
  beliefId: string;
  type: BeliefKind;
  statement: string;
  origin: string;
  confidence: number;
  evidence: EvidenceItem[];
  state: BeliefState;
  memoryClass?: MemoryClass;
  truthScore?: number;
}

export interface EvidenceItem {
  source: EvidenceSource;
  reliability: number;
  recency: number;
  agreement: number;
  repeatability: number;
  evidenceScore: number;
  strength: "weak" | "moderate" | "strong";
}

export interface BeliefInput {
  blueprintId: string;
  userId?: string;
  trigger?: string;
  memory?: string | Record<string, unknown>;
  research?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  simulation?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  signals?: Record<string, unknown>;
  constraints?: string[];
}

export interface BeliefOutput {
  sessionId: string;
  facts: BeliefRecord[];
  beliefs: BeliefRecord[];
  assumptions: BeliefRecord[];
  hypotheses: BeliefRecord[];
  confidence: number;
  uncertainty: UncertaintyResult;
  contradictions: ContradictionResult[];
  drift?: DriftResult;
}

export interface UncertaintyResult {
  certainty: number;
  uncertainty: number;
  known: string[];
  unknown: string[];
  recommendation: string;
}

export interface ContradictionResult {
  conflictType: string;
  description: string;
  action: "freeze" | "investigate" | "escalate" | "resolve";
  beliefIdA?: string;
  beliefIdB?: string;
}

export interface DriftResult {
  detected: boolean;
  signals: string[];
  action: "revalidation" | "rollback" | "governance" | "none";
}

export interface HypothesisClaim {
  claim: string;
  support: number;
  risk: number;
  testPlan: string;
}

export interface TruthAssessment {
  truthScore: number;
  stability: number;
  certainty: number;
  category: TruthCategory;
  conflicts: string[];
  expiresAt?: Date;
}
