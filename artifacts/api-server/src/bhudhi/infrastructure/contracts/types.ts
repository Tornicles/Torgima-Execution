export type RuntimeType = "local" | "container" | "cloud" | "edge" | "hybrid";
export type DeploymentStrategy = "blue" | "green" | "rolling" | "canary" | "shadow";
export type ScalingMode = "MANUAL" | "AUTO" | "PREDICTIVE" | "GOVERNED";
export type TenancyMode = "single" | "multi" | "isolated" | "enterprise";
export type EdgeMode = "GLOBAL" | "REGIONAL" | "LOCAL";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type ObservabilityView = "live" | "hourly" | "daily" | "historical";

export interface InfrastructureInput {
  blueprintId: string;
  execution?: Record<string, unknown>;
  economics?: Record<string, unknown>;
  traffic?: Record<string, unknown>;
  security?: Record<string, unknown>;
  world?: Record<string, unknown>;
  governor?: Record<string, unknown>;
  constraints?: string[];
  runtimePreference?: RuntimeType;
  tenancyMode?: TenancyMode;
}

export interface InfrastructureOutput {
  sessionId: string;
  environment: string;
  capacity: CapacityResult;
  risk: number;
  deploymentPlan: DeploymentPlan;
  runtime?: RuntimeResult;
  scale?: ScaleResult;
}

export interface CapacityResult {
  total: number;
  available: number;
  utilization: number;
  canSupport: boolean;
}

export interface DeploymentPlan {
  strategy: DeploymentStrategy;
  rollbackAvailable: boolean;
  steps: string[];
  recommendation: string;
}

export interface RuntimeResult {
  runtime: RuntimeType;
  health: number;
  latencyMs: number;
  throughput: number;
  stability: number;
  recommendation: string;
}

export interface ScaleResult {
  scale: number;
  forecast: number;
  cost: number;
  mode: ScalingMode;
}

export interface AllocationResult {
  allocated: Record<string, number>;
  utilization: number;
  waste: number;
}

export interface RecoveryResult {
  action: "failover" | "reroute" | "rollback" | "rebuild";
  target: string;
  steps: string[];
}
