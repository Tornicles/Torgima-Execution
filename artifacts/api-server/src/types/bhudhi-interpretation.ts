/** BHUDHI_SYSTEM_SPECIFICATION.md — interpretation layer types. */

export interface BhudhiRefinementOption {
  option: string;
  why: string;
  confidence: number;
  angle?: string;
}

export interface GoalExtraction {
  object: string;
  outcome: string;
  intent: string;
  domain: string;
  objectType?: string;
  objectCategory?: string;
  primaryDomain?: string;
  secondaryDomain?: string;
  tertiaryDomain?: string;
  outcomeSpecificity?: number;
  intentConfidence?: number;
}

export interface GoalInterpretationResult {
  raw_goal: string;
  goal_extraction: GoalExtraction;
  gaps: string[];
  ambiguity_level: number;
  ready_for_refinement: boolean;
  refinement_options: BhudhiRefinementOption[];
}

export interface PurposeExtraction {
  problem: string;
  target_user: string;
  change: string;
  value: string[];
}

export interface PurposeClarityScores {
  problem: number;
  target_user: number;
  change: number;
  value: number;
}

export interface PurposeInterpretationResult {
  raw_purpose: string;
  purpose_extraction: PurposeExtraction;
  clarity_scores: PurposeClarityScores;
  who_benefits?: string[];
  pain_points_addressed?: string[];
  ready_for_refinement: boolean;
  refinement_options: BhudhiRefinementOption[];
}

export interface ContextRawInputs {
  timeframe?: string;
  location?: string;
  business_type?: string;
  people?: number;
  commitment?: string;
  budget?: string | number;
  limits?: string[];
  [key: string]: unknown;
}

export interface ContextInterpretationResult {
  raw_inputs: ContextRawInputs;
  extracted_execution_pressure: number;
  extracted_capability_expectation: string;
  workload_model: {
    hours_available_per_week: number;
    total_hours_available: number;
    hours_per_day: number;
    days_working: number;
  };
  constraint_severity: {
    time: number;
    money: number;
    team: number;
    external_resources: number;
  };
  execution_reality: string;
  execution_confidence: number;
}

export interface FeedbackInterpretInput {
  task_id?: string;
  completed: string;
  score: number;
  reflection?: string;
  proof?: string;
  blocker?: string;
  confidence?: number;
}

export interface BlockerAnalysis {
  detected: boolean;
  type: string;
  severity: number;
  impact_areas: string[];
}

export interface FeedbackInterpretationResult {
  completion_status: string;
  completion_score: number;
  performance_score: number;
  blocker_analysis: BlockerAnalysis;
  insights: string[];
  key_insight?: string;
  learning_extracted?: string;
  triggers_regeneration: boolean;
  reason_for_regeneration?: string;
  feedback_quality: "low" | "medium" | "high";
  feedback_confidence: number;
}

export interface PatternAnalysisResult {
  patterns: {
    completion: number;
    quality: number;
    velocity: number;
    learning: number;
    consistency: number;
  };
  trend: string;
  momentum: number;
  confidence_in_patterns: number;
  ready_for_signals: boolean;
}

export interface BehaviorExtractionResult {
  execution_patterns: Record<string, string>;
  consistency: number;
  grit_indicators: number;
  discipline_indicators: number;
  learning_velocity: number;
  decision_patterns: {
    risk_aversion: number;
    overthinking: number;
    action_speed: number;
  };
  capabilities_discovered: string[];
  growth_areas: string[];
}
