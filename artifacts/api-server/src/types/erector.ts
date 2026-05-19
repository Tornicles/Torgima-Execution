export type ErectorVerdict = "proceed" | "adjust" | "pivot";
export type BlueprintLevel = "starter" | "growth" | "ultimate";
export type ErectorPathType = "current" | "adjusted" | "alternative";

export interface ErectorValidationInput {
  userId: string;
  blueprintId: string;
  idempotencyKey: string;
  rawGoal: string;
  purpose: string;
  timeframe: "30d" | "90d" | "6m" | "1yr" | "custom" | string;
  customTimeframeDays?: number;
  commitmentLevel: "LOW" | "MEDIUM" | "HIGH" | "INTENSE" | string;
  desiredOutcome: string;
  location: { country: string; city?: string };
  businessType: "online" | "offline" | "hybrid";
  businessModel: string;
  budgetAvailable: number;
  currency: string;
  currentResources: string[];
  targetCustomer: string;
  knownBlockers?: string[];
  successSignal?: string;
  currentContext?: string;
  domainHint?: string | null;
  tier?: BlueprintLevel;
  mode?: string;
}

export interface RiskFactor {
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical" | string;
}

export interface OpportunityFactor {
  name: string;
  description: string;
}

export interface EconomicArchetypeProfile {
  id: string;
  archetypeNumber: number;
  name: string;
  countries: string[];
  institutionalStrength: number;
  corruptionIndex: number;
  infrastructureQuality: number;
  digitalAdoption: number;
  consumerPurchasingPower: number;
  startupEcosystemMaturity: number;
  regulatoryOpenness: number;
  politicalStability: number;
  laborMarketFlexibility: number;
  marketCompetitionDensity: number;
  consumerBehaviorPatterns: string[];
  typicalResistancePatterns: string[];
  survivorBehaviorPatterns: string[];
  culturalBusinessNorms: string[];
  primaryRiskFactors: RiskFactor[];
  primaryOpportunityFactors: OpportunityFactor[];
  timeframePressureMultiplier: number;
  executionIntensityMultiplier: number;
  blueprintDifficultyAdjustment: number;
}

export interface ArchetypeResolutionOutput {
  primaryArchetype: EconomicArchetypeProfile;
  secondaryArchetypes: EconomicArchetypeProfile[];
  combinedTimeframePressureMultiplier: number;
  combinedExecutionIntensityMultiplier: number;
  economySpecificWarnings: string[];
  economySpecificOpportunities: string[];
  narrative?: {
    economyNarrative: string;
    keyWarnings: string[];
    keyOpportunities: string[];
  };
}

export interface ErectorScores {
  marketScore: number;
  executionScore: number;
  timingScore: number;
  competitionScore: number;
  scalabilityScore: number;
  localEconomyScore: number;
  resourceScore: number;
  blueprintDifficultyScore: number;
  riskScore: number;
  momentumPotential: number;
  trustBuildingScore: number;
  realityScore: number;
  verdict: ErectorVerdict;
  recommendedBlueprintLevel: BlueprintLevel;
}

export interface ValidationPathOutput {
  pathType: ErectorPathType;
  description: string;
  modifications: string[];
  expectedDifficulty: string;
  probabilityOfSuccess: number;
  timelineAdjustment: string;
  blueprintLevelRecommendation: BlueprintLevel;
  keyRisks: string[];
  keyAdvantages: string[];
  firstWeekActionsPreview: string[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface TimeSimulationOutput {
  timeframe: string;
  dailyTaskCount: { min: number; max: number; average: number };
  weeklyOutputRequirements: string[];
  estimatedRevenueTimeline: string;
  requiredCapitalBurn: number;
  executionIntensityLabel: "extreme" | "very_high" | "high" | "moderate" | "sustainable";
  probabilityOfReachingGoal: number;
  majorRiskPoints: string[];
  criticalSuccessFactors: string[];
}

export interface ErectorValidationResult {
  validationId: string;
  blueprintId: string;
  validationStage: string;
  verdict: ErectorVerdict;
  scores: ErectorScores;
  archetypeResolution: ArchetypeResolutionOutput;
  purposeDecomposition: Record<string, unknown>;
  industryIntelligence: Record<string, unknown>;
  marketAnalysis: Record<string, unknown>;
  competitorAnalysis: Record<string, unknown>;
  economyBriefing: Record<string, unknown>;
  customerPainAnalysis: Record<string, unknown>;
  executionDifficulty: Record<string, unknown>;
  timeSimulations: TimeSimulationOutput[];
  paths: {
    current: ValidationPathOutput;
    adjusted: ValidationPathOutput;
    alternative: ValidationPathOutput;
  };
  recommendedBlueprintLevel: BlueprintLevel;
}
