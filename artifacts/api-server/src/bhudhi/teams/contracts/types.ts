export type ConsensusModel = "owner" | "majority" | "weighted" | "unanimous" | "advisor";
export type HumanAgentMode = "human-led" | "agent-assisted" | "agent-operated" | "review-required";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type HealthAction = "recover" | "adapt" | "escalate" | "none";

export interface TeamMember {
  userId: string;
  role?: string;
  isAgent?: boolean;
  weight?: number;
}

export interface TeamInput {
  blueprintId: string;
  teamId?: string;
  name?: string;
  members?: TeamMember[];
  roles?: Array<{ roleKey: string; userId?: string }>;
  identity?: Record<string, unknown>;
  projects?: Array<{ id: string; name: string; ownerId?: string; status?: string }>;
  execution?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  constraints?: string[];
  consensusModel?: ConsensusModel;
}

export interface TeamOutput {
  sessionId: string;
  teamId: string;
  teamState: TeamState;
  alignment: number;
  capacity: CapacityResult;
  recommendation: string;
  teamIdentity?: TeamIdentityResult;
  coordination?: CoordinationResult;
  consensus?: ConsensusResult;
  execution?: TeamExecutionResult;
  health?: TeamHealthResult;
}

export interface TeamState {
  memberCount: number;
  humanCount: number;
  agentCount: number;
  ownerId?: string;
}

export interface CapacityResult {
  total: number;
  allocated: number;
  available: number;
}

export interface TeamIdentityResult {
  identity: Record<string, unknown>;
  health: number;
  drift: number;
}

export interface CoordinationResult {
  coordinationScore: number;
  friction: number;
  actions: string[];
}

export interface ConsensusResult {
  decision: string;
  confidence: number;
  agreement: number;
  model: ConsensusModel;
}

export interface TeamExecutionResult {
  velocity: number;
  blockers: string[];
  completion: number;
}

export interface TeamHealthResult {
  score: number;
  burnout: number;
  load: number;
  trust: number;
  momentum: number;
  engagement: number;
  action: HealthAction;
}

export interface AlignmentResult {
  alignment: number;
  conflicts: string[];
  recommendations: string[];
}
