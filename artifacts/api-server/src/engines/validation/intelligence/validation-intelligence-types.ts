import type { BlueprintTier } from "../../blueprint/infrastructure/blueprint-types.js";
import type { StructuredGoalDraft, ValidationPath, ValidationVerdict } from "../../../types/validation.js";

export type DomainType = "genesis" | "market" | "delivery" | "operations" | "growth";
export type ReadinessState =
  | "not_ready"
  | "partial"
  | "ready_proceed"
  | "ready_with_adjustment"
  | "blocked_pivot";

export interface IndustryClassification {
  industry: string;
  niche: string;
  domain: DomainType;
  category: string;
  keywords: string[];
}

export interface CISContext {
  blueprintId: string;
  userId: string;
  domain: DomainType;
  industry: string;
  niche: string;
  systemState: string;
  executionContext: string;
  tier: BlueprintTier;
  mode: string;
}

export interface TrendSignal {
  label: string;
  direction: "up" | "down" | "stable" | "volatile";
  summary: string;
}

export interface DemandSignal {
  direction: "rising" | "stable" | "declining" | "volatile";
  strength: "weak" | "moderate" | "strong" | "proven";
  evidence: string[];
  demand_type: "proven" | "emerging" | "speculative";
}

export interface CompetitorInsight {
  tier: "dominant" | "established" | "emerging";
  name: string;
  differentiators: string[];
  gap_opportunities: string[];
  threat_level: "low" | "medium" | "high";
}

export interface StrategicWindow {
  label: string;
  timing: string;
  leverage: string;
  closesWhen?: string;
}

export interface EISIntelligence {
  industry: string;
  niche: string;
  domain: DomainType;
  macro_trends: TrendSignal[];
  micro_trends: TrendSignal[];
  demand_signal: DemandSignal;
  saturation_level: "low" | "medium" | "high" | "critical";
  opportunity_windows: StrategicWindow[];
  competitor_landscape: CompetitorInsight[];
  platform_context: Array<{ platform: string; condition: string; implication: string }>;
  strategic_windows: StrategicWindow[];
  last_updated: string;
  confidence_score: number;
  source: "EIS" | "EIS+fallback";
}

export interface IndustryIntelligencePanel {
  industryOverview: Record<string, string | string[]>;
  demandIntelligence: Record<string, string | string[]>;
  competitiveLandscape: Record<string, string | string[]>;
  executionReality: Record<string, string | string[]>;
  riskMap: Array<{
    title: string;
    level: "low" | "medium" | "high" | "critical";
    trigger: string;
    prevention: string;
    recovery: string;
  }>;
  strategicWindows: Record<string, string | string[]>;
  verdictContext: Record<string, string | string[]>;
}

export interface ValidationTabContent {
  market: Record<string, string | string[]>;
  demand: Record<string, string | string[]>;
  feasibility: Record<string, string | string[]>;
  context: Record<string, string | string[]>;
}

export interface RiskFlag {
  id: string;
  title: string;
  level: "low" | "medium" | "high" | "critical";
  resolvable: boolean;
  prevention: string;
  recovery: string;
  source: "EIS" | "SIS" | "PIS";
}

export interface FeasibilityAssessment {
  score: number;
  effortLevel: "low" | "medium" | "high" | "very_high";
  timeframeRealistic: boolean;
  complexity: "simple" | "moderate" | "complex" | "highly_complex";
  skillRequirements: string[];
  resourceRequirements: string[];
  risks: string[];
  explanation: string;
}

export interface PathScenario {
  bestCase: string;
  likelyCase: string;
  worstCase: string;
  probabilityOfSuccess?: number;
}

export interface EnrichedValidationPath extends ValidationPath {
  strengths?: string[];
  risks?: string[];
  requiredConditions?: string[];
  whatChanged?: string[];
  unlocks?: string[];
  scenario?: PathScenario;
  comparisonNote?: string;
}

export interface PISPrediction {
  risk_flags: RiskFlag[];
  predicted_obstacles: string[];
  probability_score?: number;
  kill_conditions?: string[];
  strategic_assumptions: string[];
}

export interface ValidationIntelligencePayload {
  cis: CISContext;
  iis: StructuredGoalDraft;
  eis: EISIntelligence;
  industryPanel: IndustryIntelligencePanel;
  tabs: ValidationTabContent;
  paths: {
    current: EnrichedValidationPath;
    adjusted: EnrichedValidationPath;
    alternative: EnrichedValidationPath;
  };
  feasibility: FeasibilityAssessment;
  pis: PISPrediction;
  verdict: ValidationVerdict;
  verdictReasoning: string;
  readiness: ReadinessState;
  launchBlocked: boolean;
  tier: BlueprintTier;
  systemsProgress: Record<string, "pending" | "running" | "complete">;
}

export interface ValidationToBlueprintContract {
  refined_goal: string;
  measurable_target: string;
  execution_version: string;
  industry: string;
  niche: string;
  domain: DomainType;
  demand_signal: DemandSignal;
  saturation_level: string;
  competitive_context: CompetitorInsight[];
  selected_path_type: "current" | "adjusted" | "alternative";
  path_summary: string;
  strategic_adjustments: string[];
  risk_flags: RiskFlag[];
  probability_score?: number;
  predicted_obstacles: string[];
  timeframe_validated: boolean;
  effort_level: string;
  resource_requirements: string[];
  feasibility_score: number;
  max_phases: number;
  required_first_domain: DomainType;
  demand_validation_required: boolean;
  scaling_blocked_until: string | null;
  plan_skeleton?: ValidationPath["planSkeleton"];
}

export interface FullValidationResult {
  validationId: string;
  validationContractId?: string;
  blueprintId: string;
  verdict: ValidationVerdict;
  scores: import("../../../types/validation.js").ValidationScores;
  paths: {
    current: EnrichedValidationPath;
    adjusted: EnrichedValidationPath;
    alternative: EnrichedValidationPath;
  };
  intelligence: ValidationIntelligencePayload;
  blueprintContract: ValidationToBlueprintContract | null;
  usedFallback: boolean;
  aiSummary?: string;
  launchBlocked: boolean;
  readiness: ReadinessState;
  createdAt: Date;
}
