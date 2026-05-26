export type OrgNodeKind =
  | "organization"
  | "team"
  | "role"
  | "user"
  | "project"
  | "resource"
  | "goal";

export type OrgRelation =
  | "owns"
  | "reports_to"
  | "collaborates"
  | "blocks"
  | "depends_on"
  | "supports";

export type AuthorityLevel = "OWNER" | "EXECUTIVE" | "MANAGER" | "LEAD" | "MEMBER" | "OBSERVER";
export type Permission = "read" | "approve" | "execute" | "delegate" | "freeze" | "escalate";
export type Department =
  | "strategy"
  | "product"
  | "engineering"
  | "operations"
  | "research"
  | "marketing"
  | "finance";

export type HealthAction = "recover" | "adapt" | "escalate" | "none";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";

export interface OrgNode {
  id: string;
  kind: OrgNodeKind;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface OrgEdge {
  from: string;
  to: string;
  type: OrgRelation;
}

export interface OrgInput {
  blueprintId: string;
  organizationId?: string;
  name?: string;
  users?: Array<{ userId: string; role?: string; department?: Department }>;
  roles?: Array<{ roleKey: string; authority: AuthorityLevel; department?: Department }>;
  projects?: Array<{ id: string; name: string; ownerId?: string; status?: string }>;
  execution?: Record<string, unknown>;
  world?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  signals?: Record<string, unknown>;
  strategy?: Record<string, unknown>;
  constraints?: string[];
}

export interface OrganizationState {
  organizationId: string;
  name: string;
  nodeCount: number;
  ownerId?: string;
}

export interface CapacityResult {
  total: number;
  allocated: number;
  available: number;
  utilization: number;
}

export interface HealthResult {
  score: number;
  execution: number;
  culture: number;
  strategy: number;
  risk: number;
  resilience: number;
  action: HealthAction;
}

export interface AlignmentResult {
  score: number;
  gaps: string[];
  recommendations: string[];
}

export interface OrgOutput {
  sessionId: string;
  organizationState: OrganizationState;
  capacity: CapacityResult;
  health: HealthResult;
  alignment: AlignmentResult;
  graph: { nodes: OrgNode[]; edges: OrgEdge[] };
  culture?: CultureProfile;
  strategy?: StrategyResult;
  coordination?: CoordinationResult;
  teamSync?: TeamSyncResult;
}

export interface CultureProfile {
  trust: number;
  clarity: number;
  ownership: number;
  accountability: number;
  burnout: number;
  cooperation: number;
  profile: string;
}

export interface StrategyResult {
  alignment: number;
  strategyHealth: number;
  recommendations: string[];
  hasVision: boolean;
}

export interface CoordinationResult {
  owners: string[];
  blocked: string[];
  actions: string[];
}

export interface TeamSyncResult {
  syncScore: number;
  issues: string[];
  actions: string[];
}

export interface DepartmentHealth {
  department: Department;
  health: number;
  risk: number;
  efficiency: number;
}
