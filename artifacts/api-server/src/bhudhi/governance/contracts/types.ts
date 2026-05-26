/** BHUDHI Governance Engine — shared contracts */

export type GovernanceActorType = "user" | "agent" | "system" | "bhudhi";

export interface GovernanceActor {
  type: GovernanceActorType;
  id: string;
}

export type GovernanceAction =
  | "READ_MEMORY"
  | "CREATE_TASKS"
  | "GENERATE_PLAN"
  | "RUN_SIMULATION"
  | "EXECUTE_WORKFLOW"
  | "MEMORY_WRITE"
  | "LEARNING_UPDATE"
  | "DEPLOY_SYSTEM"
  | "MODIFY_POLICIES"
  | "MODIFY_SIGNALS"
  | "MODIFY_CONDITIONS"
  | "REWRITE_BLUEPRINT"
  | "OVERRIDE_VALIDATION"
  | "DISABLE_TRIGGER_ROUTER"
  | "SELF_APPROVE"
  | "DELETE_AUDIT"
  | "ESCALATE_PRIVILEGE"
  | "SELF_DEPLOY"
  | "AGENT_SPAWN";

export type PolicyCategory =
  | "SYSTEM_POLICY"
  | "EXECUTION_POLICY"
  | "MEMORY_POLICY"
  | "SIMULATION_POLICY"
  | "LEARNING_POLICY"
  | "UPGRADE_POLICY"
  | "SOCIAL_POLICY"
  | "TEAM_POLICY"
  | "SECURITY_POLICY";

export type ApprovalLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export type RiskLevel = "SAFE" | "CAUTION" | "HIGH" | "CRITICAL" | "LOCK";

export type EnforcementAction =
  | "ALLOW"
  | "THROTTLE"
  | "SIMULATE"
  | "REJECT"
  | "ESCALATE"
  | "ROLLBACK";

export type EmergencyMode =
  | "SOFT_STOP"
  | "FREEZE"
  | "READ_ONLY"
  | "ROLLBACK"
  | "RECOVERY";

export type CapabilityRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "FORBIDDEN";

export interface GovernanceContext {
  blueprintId?: string;
  recommendationId?: string;
  confidence?: number;
  globalSignal?: string;
  trustScore?: number;
  costEstimate?: number;
  simulationRequired?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PolicyEvaluation {
  allowed: boolean;
  confidence: number;
  requiredApprovals: ApprovalLevel[];
  constraints: string[];
  category: PolicyCategory;
  reason?: string;
}

export interface CapabilityDefinition {
  capability: GovernanceAction;
  owner: string;
  risk: CapabilityRisk;
  requiresApproval: ApprovalLevel;
  requiresSimulation: boolean;
  requiresAudit: boolean;
  immutable: boolean;
}

export interface RiskAssessment {
  riskScore: number;
  riskType: RiskLevel;
  recommendation: string;
  requiresApproval: boolean;
}

export interface GovernanceCheckResult {
  allowed: boolean;
  enforcement: EnforcementAction;
  policy: PolicyEvaluation;
  risk: RiskAssessment;
  requiredApprovals: ApprovalLevel[];
  pendingApprovalIds: string[];
  explanation: ExplainabilityRecord;
  constraints: string[];
}

export interface ExplainabilityRecord {
  decision: string;
  why: string;
  alternatives: string[];
  evidence: string[];
  confidence: number;
  agents: string[];
  memoryUsed: string[];
  risks: string[];
  approvals: string[];
}

export interface ApprovalRequest {
  blueprintId: string;
  subjectType: string;
  subjectId: string;
  action: GovernanceAction;
  level: ApprovalLevel;
  expiresInHours?: number;
}

export interface GovernanceHealth {
  trustScore: number;
  activeEmergency: EmergencyMode | null;
  pendingApprovals: number;
  recentViolations: number;
  auditEvents24h: number;
  policiesImmutable: boolean;
}

export type AuditEventType =
  | "execution_started"
  | "policy_failed"
  | "simulation_blocked"
  | "approval_granted"
  | "approval_rejected"
  | "rollback_triggered"
  | "emergency_activated"
  | "emergency_cleared"
  | "governance_check"
  | "violation_recorded";
