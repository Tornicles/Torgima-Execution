export interface OutcomeTrackingResult {
  accuracy: number;
  learning: boolean;
  frameworkId?: string;
}

export interface KnowledgeConsolidationResult {
  success: boolean;
  learningsConsolidated: number;
  learnings: string[];
}

export interface FrameworkImprovementEntry {
  previousAccuracy: number;
  newAccuracy: number;
  improvement: number;
  version: number;
}

export interface HypothesisTestResult {
  hypothesis: string;
  controlGroup: number;
  experimentalGroup: number;
  effectSize: number;
  pValue: number;
  significant: boolean;
  confidence: "High" | "Low";
}

export interface DomainExpertiseResult {
  patternsDiscovered: number;
  topPatterns: string[];
  executionCount: number;
  expertise_level: "novice" | "intermediate" | "expert";
}
