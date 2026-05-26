/** BHUDHI Intelligence Economics Engine — contracts */

export type ExecutionMode = "MICRO" | "STANDARD" | "PREMIUM" | "RESEARCH" | "ENTERPRISE";

export type RouteStrategy = "rules" | "single_model" | "multi_agent" | "ensemble" | "governance";

export type RoiAction = "execute" | "simulate" | "delay" | "simplify" | "cancel";

export type ConfidenceTier = 0.7 | 0.8 | 0.9 | 0.95 | 0.99;

export type SimulationMode = "FAST" | "NORMAL" | "STRATEGIC" | "FULL_WORLD";

export type MemoryTier = "HOT" | "WARM" | "COLD" | "ARCHIVE" | "DELETE";

export interface EconomicsTaskInput {
  task: string;
  trigger: string;
  priority?: "low" | "normal" | "high" | "critical";
  risk?: number;
  confidence?: number;
  budgetUsd?: number;
  deadlineMs?: number;
  memoryBytes?: number;
  simulation?: boolean;
  lifeState?: string;
  userId: string;
  blueprintId?: string;
  unsafe?: boolean;
}

export interface ModelCapability {
  modelId: string;
  provider: string;
  costPerMillion: number;
  latencyMs: number;
  quality: number;
  reliability: number;
  risk: number;
  memoryFit: number;
  toolFit: number;
  simulationFit: number;
}

export interface ComputeRoutePlan {
  route: RouteStrategy;
  modelId: string;
  provider: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  expectedConfidence: number;
  executionMode: ExecutionMode;
  maxTokens: number;
  parallelism: number;
  useCache: boolean;
  useMemory: boolean;
  useSimulation: boolean;
  valueScore: number;
}

export interface IntelligenceEconomicsPlan {
  compute: ComputeRoutePlan;
  confidenceTier: ConfidenceTier;
  confidenceCostMultiplier: number;
  roi: { action: RoiAction; score: number; reasoning: string };
  simulation: { mode: SimulationMode; npcCount: number; valueRatio: number };
  memory: { tier: MemoryTier; compressionRatio: number };
  tokenBudget: { allocated: number; categories: Record<string, number> };
  blocked: boolean;
  blockReason?: string;
}

export interface EconomicsObservatoryMetrics {
  costPerRequest: number;
  costPerUser: number;
  tokensToday: number;
  cacheHitRate: number;
  wasteScore: number;
  avgValueScore: number;
  routingDistribution: Record<ExecutionMode, number>;
}

export interface EconomicsForecastPoint {
  horizonDays: number;
  costUsd: number;
  tokens: number;
  requests: number;
  memoryMb: number;
  simulationHours: number;
  confidence: number;
}
