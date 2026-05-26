import type { StoredRecommendation } from "../intelligence/IntelligenceService.js";

export const OPERATING_ENGINE_NAMES = [
  "Action Executor Engine",
  "Integration Manager Engine",
  "Workflow Orchestrator Engine",
  "Change Control Engine",
  "Gradual Rollout Engine",
  "Error Recovery Engine",
  "Performance Optimizer Engine",
  "Resource Allocator Engine",
  "Scheduling Engine",
  "Compliance Enforcer Engine",
] as const;

export type OperatingEngineName = (typeof OPERATING_ENGINE_NAMES)[number];

export const ACTION_EXECUTOR_ENGINE_ID = "op_action_executor";

export interface ExecutionSchedule {
  recommendedTime: Date;
  reason: string;
  alternatives: Date[];
  impact: string;
}

export interface RolloutPhase {
  phase: number;
  percentageOfUsers: number;
  duration: number;
  metrics: string[];
}

export interface RolloutPlan {
  strategy: "canary" | "staged" | "bluegreen";
  phases: RolloutPhase[];
  rollbackTrigger: {
    errorRateAbove: number;
    successRateBelow: number;
  };
}

export interface ExecutionResult {
  success: boolean;
  actionId?: string;
  changesApplied?: number;
  requiresIntegration?: boolean;
  error?: string;
  metrics?: {
    executionTime: number;
    resourcesUsed: number;
  };
}

export interface PerformanceOptimization {
  cacheEnabled: boolean;
  parallelizationEnabled: boolean;
  resourceOptimized: boolean;
  metricsImproved: Record<string, string>;
}

export interface WorkflowState {
  steps: string[];
  currentStep: number;
  completed: boolean;
  timeline: number;
}

export interface ResourceAllocation {
  budget: number;
  spent: number;
  remaining: number;
  efficiency: number;
}

export interface ComplianceResult {
  verified: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

export interface SecurityValidation {
  allowed: boolean;
  reason?: string;
  checks: Record<string, boolean>;
}

export interface OperatingExecutionResult {
  success: boolean;
  reason?: string;
  recommendation?: StoredRecommendation;
  executionResult?: ExecutionResult;
  optimizationResult?: PerformanceOptimization;
  workflow?: WorkflowState;
  complianceVerified?: boolean;
  complianceIssues?: string[];
  securityBlocked?: boolean;
  governanceBlocked?: boolean;
  decisionBlocked?: boolean;
  rolloutPlan?: RolloutPlan;
  schedule?: ExecutionSchedule;
}

export type OperatingRecommendation = StoredRecommendation;
