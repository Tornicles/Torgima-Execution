export type ExecutionProfile = "Explorer" | "Builder" | "Strategist" | "Operator" | "Creator";
export type MotivationType = "intrinsic" | "extrinsic" | "fear" | "purpose" | "curiosity" | "mastery";
export type IdentityRelation = "reinforces" | "weakens" | "conflicts" | "depends_on" | "transforms";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type DriftAction = "pause" | "recover" | "adapt" | "escalate";

export interface IdentityNode {
  id: string;
  kind: "values" | "goals" | "habits" | "beliefs" | "motivations" | "roles" | "relationships" | "capabilities";
  label: string;
  weight: number;
}

export interface IdentityEdge {
  from: string;
  to: string;
  type: IdentityRelation;
}

export interface RankedValue {
  key: string;
  rank: number;
  weight: number;
  protected: boolean;
  temporary: boolean;
}

export interface ValuesResult {
  rankedValues: RankedValue[];
  conflicts: string[];
  protectionRules: string[];
}

export interface MotivationResult {
  motivationType: MotivationType;
  stability: number;
  recommendations: string[];
}

export interface CapabilityResult {
  capabilityScore: number;
  ceiling: number;
  growthRate: number;
  dimensions: Record<string, { current: number; potential: number; velocity: number }>;
}

export interface PersonalityDimensions {
  speed: number;
  certainty: number;
  energy: number;
  social: number;
  structure: number;
  adaptability: number;
}

export interface GrowthResult {
  currentState: string;
  nextIdentity: string;
  recommendedTransitions: string[];
  maturity: number;
  stability: number;
}

export interface IdentityInput {
  blueprintId: string;
  userId?: string;
  trigger?: string;
  memory?: string | Record<string, unknown>;
  signals?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  life?: Record<string, unknown>;
  beliefs?: Record<string, unknown>;
  world?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  feedback?: Record<string, unknown>;
  history?: Record<string, unknown>;
  constraints?: string[];
}

export interface IdentityState {
  profileId: string;
  executionProfile: ExecutionProfile;
  stage: string;
  maturity: number;
}

export interface IdentityOutput {
  sessionId: string;
  identityState: IdentityState;
  values: ValuesResult;
  motivations: MotivationResult;
  capabilities: CapabilityResult;
  growthDirection: GrowthResult;
  personality: PersonalityDimensions;
  graph: { nodes: IdentityNode[]; edges: IdentityEdge[] };
  adaptations?: AdaptationResult;
  drift?: DriftResult;
}

export interface AdaptationResult {
  communication: string;
  tasks: string;
  timelines: string;
  execution: string;
}

export interface DriftResult {
  detected: boolean;
  signals: string[];
  action: DriftAction;
}
