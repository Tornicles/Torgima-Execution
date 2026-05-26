import type {
  BhudhiExpectedImpact,
  BhudhiInvestigation,
  GlobalSignal,
} from "@workspace/db/types/bhudhi";

export const INTELLIGENCE_ENGINE_NAMES = [
  "Framework Applicator Engine",
  "Contradiction Resolution Engine",
  "Scenario Simulator Engine",
  "Recommendation Engine",
  "Impact Analyzer Engine",
  "Risk Assessment Engine",
  "Optimization Engine",
  "Dependency Analyzer Engine",
  "Feasibility Assessment Engine",
  "Stakeholder Impact Engine",
  "Strategic Alignment Engine",
  "Learning Integration Engine",
] as const;

export type IntelligenceEngineName = (typeof INTELLIGENCE_ENGINE_NAMES)[number];

export const INTELLIGENCE_SYNTHESIS_ENGINE_ID = "int_recommendation_engine";

export interface FrameworkEvaluation {
  frameworkId: string;
  framework: string;
  signal: GlobalSignal;
  confidence: number;
  insights: string[];
  recommendation: string | null;
}

export type FrameworkAnalysis = Record<string, FrameworkEvaluation>;

export interface ScenarioOutcome {
  scale: number;
  revenue: number;
  timeline: number;
  risk: number;
  confidence: number;
}

export interface ScenarioSet {
  conservative: ScenarioOutcome;
  moderate: ScenarioOutcome;
  aggressive: ScenarioOutcome;
}

export interface DraftRecommendation {
  frameworkId: string;
  title: string;
  description: string;
  reasoning: string;
  scenario: keyof ScenarioSet;
  confidence: number;
  implementationDifficulty: "easy" | "medium" | "hard";
}

export interface RecommendationRisks {
  probability: number;
  severity: "low" | "medium" | "high";
  mitigation: string;
  contingency: string;
}

export interface RecommendationDependencies {
  dependencies: string[];
  criticalPath: string[];
  blockers: string[];
}

export interface RecommendationFeasibility {
  feasible: boolean;
  difficulty: "easy" | "medium" | "hard";
  resources: string;
  timeline: string;
  effort: string;
}

export interface StakeholderImpact {
  winners: string[];
  losers: string[];
  adoptionLikelihood: number;
  changeManagement: string;
}

export interface StrategicAlignment {
  aligned: boolean;
  alignmentScore: number;
  strategicValue: string;
  constraints: string[];
}

export interface RecommendationOptimization {
  optimized: boolean;
  efficiency: number;
  costReduction: number;
}

export interface EnrichedRecommendation extends DraftRecommendation {
  expectedImpact: BhudhiExpectedImpact;
  risks: RecommendationRisks;
  dependencies: RecommendationDependencies;
  feasibility: RecommendationFeasibility;
  stakeholderImpact: StakeholderImpact;
  strategicAlignment: StrategicAlignment;
  optimization: RecommendationOptimization;
  learningsUsed: string[];
}

export type FrameworkRow = {
  id: string;
  name: string;
  type: string;
  domains: unknown;
  accuracy: number;
  status: string;
};

export type InvestigationInput = BhudhiInvestigation[];
