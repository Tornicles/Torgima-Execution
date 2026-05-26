export type WorldMode = "FAST" | "STANDARD" | "STRATEGIC" | "REALITY";
export type ScenarioKind = "baseline" | "optimistic" | "realistic" | "stress" | "collapse";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";

export interface ErectorInput {
  blueprintId: string;
  goal?: string;
  validation?: Record<string, unknown>;
  blueprint?: Record<string, unknown>;
  world?: Record<string, unknown>;
  identity?: Record<string, unknown>;
  time?: Record<string, unknown>;
  constraints?: string[];
  seed?: string;
  mode?: WorldMode;
  scenario?: ScenarioKind;
}

export interface ErectorOutput {
  simulationId: string;
  runId: string;
  worldId: string;
  outcomes: SimulationOutcomes;
  confidence: number;
  recommendation: string;
  score?: SimulationScoreResult;
  scenarios?: ScenarioResult[];
}

export interface GeneratedWorld {
  market: Record<string, unknown>;
  organization: Record<string, unknown>;
  individuals: Array<Record<string, unknown>>;
  systems: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  resources: Record<string, unknown>;
}

export interface ScenarioResult {
  scenario: ScenarioKind;
  probability: number;
  risk: number;
}

export interface Actor {
  id: string;
  kind: "user" | "team" | "customer" | "competitor" | "agent";
  goals: string[];
  beliefs: string[];
  resources: Record<string, number>;
  behavior: string;
}

export interface EconomicResult {
  economicHealth: number;
  risk: number;
  trajectory: "growth" | "stable" | "decline";
}

export interface SimulationOutcomes {
  events: Array<{ at: number; type: string; detail: string }>;
  history: string[];
  pressure: number;
  survived: boolean;
}

export interface SimulationScoreResult {
  survival: number;
  goalAchievement: number;
  efficiency: number;
  resilience: number;
  risk: number;
  overall: number;
  confidence: number;
}

export interface CompareResult {
  runs: Array<{ simulationId: string; overall: number; recommendation: string }>;
  winner: string;
}
