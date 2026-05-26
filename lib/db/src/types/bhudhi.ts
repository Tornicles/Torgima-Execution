/**
 * BHUDHI PROMPT 1 — Canonical TypeScript models (match bhudhi_* tables).
 */

export type BhudhiSystemId =
  | "investigation"
  | "intelligence"
  | "operating"
  | "security"
  | "preservation";

export type BhudhiEngineType =
  | "investigation"
  | "intelligence"
  | "operating"
  | "preservation";

export type BhudhiSystemStatus = "active" | "inactive";
export type BhudhiEngineStatus = "active" | "paused" | "error";
export type BhudhiFrameworkType = "team" | "individual";
export type BhudhiFrameworkStatus = "active" | "inactive";

export type GlobalSignal =
  | "nothingness"
  | "danger"
  | "urgency"
  | "stability"
  | "power"
  | "affluence"
  | "powerchange";

export type BhudhiDomainName =
  | "genesis"
  | "market"
  | "delivery"
  | "operations"
  | "growth"
  | "continuity"
  | "people";

export type FrameworkRole = "lead" | "veto" | "advise" | "blocked";

export interface BhudhiEngineMetrics {
  executionsCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastResultCount: number;
}

export interface BhudhiSystem {
  id: BhudhiSystemId;
  name: BhudhiSystemId;
  description: string;
  status: BhudhiSystemStatus;
  lastAnalyzedAt: Date | null;
  engineCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiEngine {
  id: string;
  systemId: BhudhiSystemId;
  name: string;
  type: BhudhiEngineType;
  description: string;
  status: BhudhiEngineStatus;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  configuration?: Record<string, unknown>;
  metrics: BhudhiEngineMetrics;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiFramework {
  id: string;
  name: string;
  type: BhudhiFrameworkType;
  description: string;
  domains: string[];
  status: BhudhiFrameworkStatus;
  version: number;
  logic?: Record<string, unknown>;
  accuracy: number;
  confidenceThreshold: number;
  improvementHistory?: unknown[];
  weeklyAccuracy: number[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiDomain {
  id: BhudhiDomainName;
  name: BhudhiDomainName;
  description: string;
  activeFrameworks: string[];
  frameworkRoles: Record<string, FrameworkRole>;
  settings?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiSignalMetrics {
  completionRate: number;
  momentum: number;
  trend: "improving" | "stable" | "declining";
  confidenceLevel: number;
}

export interface BhudhiFrameworkSignalEntry {
  signal: GlobalSignal;
  confidence: number;
  reasoning: string;
}

export interface BhudhiSignal {
  id: string;
  blueprintId: string;
  globalSignal: GlobalSignal;
  globalSignalConfidence: number;
  frameworkSignals: Record<string, BhudhiFrameworkSignalEntry>;
  metrics: BhudhiSignalMetrics;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InvestigationSubject =
  | "execution"
  | "external_system"
  | "patterns"
  | "anomalies"
  | "risks"
  | "opportunities";

export interface BhudhiInvestigationFindings {
  patterns: string[];
  anomalies: string[];
  insights: string[];
  rootCauses: Array<{ cause: string; confidence: number }>;
  benchmarks: Record<string, unknown>;
}

export interface BhudhiInvestigation {
  id: string;
  blueprintId: string;
  engineId: string;
  subject: InvestigationSubject;
  findings: BhudhiInvestigationFindings;
  confidence: number;
  severity: "low" | "medium" | "high";
  actionable: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiExpectedImpact {
  revenue?: number;
  efficiency?: number;
  risk?: number;
  timeline?: number;
}

export interface BhudhiRecommendationIntelligenceMeta {
  risks?: {
    probability: number;
    severity: "low" | "medium" | "high";
    mitigation: string;
    contingency: string;
  };
  dependencies?: {
    dependencies: string[];
    criticalPath: string[];
    blockers: string[];
  };
  feasibility?: {
    feasible: boolean;
    difficulty: "easy" | "medium" | "hard";
    resources: string;
    timeline: string;
    effort: string;
  };
  stakeholderImpact?: {
    winners: string[];
    losers: string[];
    adoptionLikelihood: number;
    changeManagement: string;
  };
  strategicAlignment?: {
    aligned: boolean;
    alignmentScore: number;
    strategicValue: string;
    constraints: string[];
  };
  optimization?: {
    optimized: boolean;
    efficiency: number;
    costReduction: number;
  };
  learningsUsed?: string[];
  scenario?: string;
  frameworkId?: string;
}

export interface BhudhiRecommendation {
  id: string;
  blueprintId: string;
  engineId: string;
  title: string;
  description: string;
  reasoning: string;
  expectedImpact: BhudhiExpectedImpact;
  confidence: number;
  implementationDifficulty: "easy" | "medium" | "hard";
  status: "pending" | "approved" | "denied" | "implemented";
  appliedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BhudhiExecutionEventType =
  | "task_completed"
  | "feedback_received"
  | "signal_updated"
  | "recommendation_applied"
  | "engine_run";

export interface BhudhiExecutionEvent {
  id: string;
  blueprintId: string;
  eventType: BhudhiExecutionEventType;
  description: string;
  data: {
    taskId?: string;
    feedback?: Record<string, unknown>;
    signals?: Record<string, unknown>;
    recommendations?: string[];
    metrics?: Record<string, unknown>;
  };
  learningsGenerated: string[];
  frameworksImproved: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type BhudhiLearningType =
  | "accuracy_improvement"
  | "new_pattern"
  | "edge_case"
  | "contradiction_resolution";

export interface BhudhiFrameworkLearning {
  id: string;
  frameworkId: string;
  learningType: BhudhiLearningType;
  previousAccuracy: number;
  newAccuracy: number;
  improvement: number;
  sourceEvent?: string | null;
  evidence: Record<string, unknown>;
  status: "validated" | "pending_validation" | "rejected";
  createdAt?: Date;
  updatedAt?: Date;
}

export type BhudhiExternalSystemType =
  | "crm"
  | "hrms"
  | "data_platform"
  | "communication"
  | "custom";

export type BhudhiSyncFrequency = "realtime" | "hourly" | "daily";

export interface BhudhiExternalConnection {
  id: string;
  blueprintId: string;
  systemName: string;
  systemType: BhudhiExternalSystemType;
  syncFrequency: BhudhiSyncFrequency;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  status: "active" | "paused" | "error";
  errorMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BhudhiExternalData {
  id: string;
  connectionId: string;
  dataType: string;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  investigationIds: string[];
  insights: string[];
  createdAt?: Date;
  updatedAt?: Date;
}
