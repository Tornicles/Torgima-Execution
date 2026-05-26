export type EvolutionMode = "stable" | "expanding" | "fragile" | "collapsing";
export type MemoryClass = "ACTIVE" | "ARCHIVE" | "SEALED";
export type TrajectoryKind = "growth" | "stable" | "decline" | "compound" | "collapse";

export interface CivilizationInput {
  blueprintId: string;
  civilizationId?: string;
  name?: string;
  world?: Record<string, unknown>;
  economy?: Record<string, unknown>;
  teams?: Array<Record<string, unknown>>;
  organizations?: Array<Record<string, unknown>>;
  time?: Record<string, unknown>;
  constraints?: string[];
  seed?: string;
  simulation?: Record<string, unknown>;
}

export interface CivilizationState {
  population: number;
  institutions: number;
  markets: number;
  ecosystems: number;
  phase: string;
}

export interface CivilizationOutput {
  civilizationId: string;
  sessionId: string;
  civilizationState: CivilizationState;
  resilience: number;
  trajectory: TrajectoryKind;
  evolutionMode: EvolutionMode;
  recommendation: string;
  population?: PopulationResult;
  institutions?: InstitutionResult;
  ecosystem?: EcosystemResult;
  civilEconomy?: CivilEconomyResult;
  evolution?: EvolutionResult;
  governance?: GovernanceObserveResult;
  resilienceDetail?: ResilienceResult;
  forecast?: LongHorizonResult;
}

export interface PopulationResult {
  populationHealth: number;
  distribution: Record<string, number>;
}

export interface InstitutionResult {
  institutionEffectiveness: number;
  coordination: number;
  adaptation: number;
}

export interface EcosystemResult {
  ecosystemHealth: number;
  systemRisk: number;
}

export interface CivilEconomyResult {
  economicTrajectory: TrajectoryKind;
  production: number;
  inefficiency: number;
}

export interface EvolutionResult {
  mode: EvolutionMode;
  adaptation: number;
  selection: number;
  innovation: number;
  survival: number;
}

export interface GovernanceObserveResult {
  coordination: number;
  efficiency: number;
  transparency: number;
  resilience: number;
  action: "recommend" | "stress" | "compare" | "measure";
}

export interface StressTestScenario {
  name: string;
  impact: number;
}

export interface ResilienceResult {
  resilienceScore: number;
  recoveryProfile: Record<string, number>;
  stressTests?: StressTestScenario[];
  recoveryTimeYears?: number;
  antifragilityScore?: number;
}

export interface YearSimulationPoint {
  year: number;
  population: number;
  institutions: number;
  economicOutput: number;
  ecosystem: number;
  resilience: number;
  momentum: "growing" | "stable" | "declining";
  trajectory: TrajectoryKind;
}

export interface InflectionPoint {
  year: number;
  from: string;
  to: string;
}

export interface HorizonForecast {
  horizonYears: number;
  trajectory: TrajectoryKind;
  confidence: number;
}

export interface LongHorizonResult {
  horizons: HorizonForecast[];
  trajectory: TrajectoryKind;
  confidence: number;
}
