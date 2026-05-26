// ── LEGACY SHAPE (Prompts 1–5 active wiring) ─────────────────────────────────
// Used by BhudhiCore, TriggerRouter, FallbackLibrary, OutputValidator, and the
// /api/bhudhi/* routes today. Replaced/extended by the canonical shape below
// when Bhudhi gets its full implementation in Prompt 9.

export type BhudhiTrigger =
  | "goal_validation"
  | "blueprint_generation"
  | "task_generation"
  | "task_regeneration"
  | "feedback_interpretation"
  | "feedback_interrogation"
  | "condition_explanation"
  | "recovery_suggestion"
  | "dashboard_summary";

export interface BhudhiRequest {
  trigger:        BhudhiTrigger;
  userId:         string;
  context:        Record<string, unknown>;
  modelOverride?: string;
}

export interface BhudhiResponse {
  trigger:      BhudhiTrigger;
  output:       Record<string, unknown>;
  model:        string;
  tokensUsed:   number;
  latencyMs:    number;
  valid:        boolean;
  fallbackUsed: boolean;
}

export interface BhudhiLogEntry {
  id:           string;
  userId:       string;
  trigger:      BhudhiTrigger;
  model:        string;
  tokensUsed:   number;
  latencyMs:    number;
  valid:        boolean;
  fallbackUsed: boolean;
  createdAt:    string;
}

// ── CANONICAL SHAPE (Prompt 1 §types/bhudhi) ─────────────────────────────────
// The contract Bhudhi must honour everywhere it speaks. Bhudhi NEVER decides,
// mutates, or overrides — those modes are explicitly forbidden. The router
// downgrades any output produced under a forbidden mode to a fallback.

export type BhudhiMode =
  | "INTERPRET"
  | "STRUCTURE"
  | "DRAFT"
  | "EXPLAIN"
  | "SUGGEST"
  | "DECIDE"
  | "MUTATE"
  | "OVERRIDE";

export const FORBIDDEN_MODES: readonly BhudhiMode[] = ["DECIDE", "MUTATE", "OVERRIDE"];

export type BhudhiTriggerType =
  | "GOAL_STRUCTURING"
  | "REALITY_INTELLIGENCE"
  | "EIS_INDUSTRY_RESEARCH"
  | "TASK_DRAFTING"
  | "FEEDBACK_CLASSIFICATION"
  | "CLARIFICATION_PROMPT"
  | "RECOVERY_COPY"
  | "STATE_EXPLANATION"
  | "OUTCOME_EVIDENCE_SUMMARY"
  | "ACADEMY_SUPPORT"
  | "ACADEMY_SKILL_ASSESSMENT"
  | "ACADEMY_GAP_SEVERITY"
  | "ROOT_CAUSE_ASSIST"
  | "DIRECTION_ANALYSIS"
  | "BEHAVIORAL_INSIGHT"
  | "SIGNAL_NARRATIVE"
  | "INACTIVITY_RESTART"
  | "BLUEPRINT_GENERATION"
  | "BLUEPRINT_INTERPRETATION"
  | "DOMAIN_RESOLUTION"
  | "EXECUTION_SUPPORT"
  | "BEHAVIORAL_ANALYSIS"
  | "EIS_COMPETITOR_INTELLIGENCE"
  | "EIS_NARRATIVE_INTELLIGENCE"
  | "EIS_OPPORTUNITY_SYNTHESIS"
  | "EIS_SYNTHESIS"
  | "ERECTOR_ARCHETYPE_NARRATIVE"
  | "ERECTOR_PURPOSE_DECOMPOSE"
  | "ERECTOR_INDUSTRY_ANALYZE"
  | "ERECTOR_MARKET_ANALYZE"
  | "ERECTOR_COMPETITORS_IDENTIFY"
  | "ERECTOR_ECONOMY_BRIEFING"
  | "ERECTOR_PAIN_ANALYZE"
  | "ERECTOR_SIMULATE_TIMEFRAMES"
  | "ERECTOR_PATHS_GENERATE"
  | "ERECTOR_FIRST_WEEK"
  | "ERECTOR_GOAL_REFINE"
  | "ERECTOR_PURPOSE_REFINE"
  | "VALIDATE_STAGE_2_DECOMPOSITION"
  | "VALIDATE_STAGE_3_ECONOMIC"
  | "VALIDATE_STAGE_4_PATTERNS"
  | "VALIDATE_STAGE_5_TIMING"
  | "VALIDATE_STAGE_6_MARKET"
  | "VALIDATE_STAGE_7_CHANNELS"
  | "VALIDATE_STAGE_8_PROS"
  | "VALIDATE_STAGE_9_CONS"
  | "VALIDATE_STAGE_10_FEASIBILITY"
  | "VALIDATE_STAGE_11_VIABILITY"
  | "VALIDATE_STAGE_12_BOOTSTRAP"
  | "VALIDATE_STAGE_13_FEATURES"
  | "VALIDATE_STAGE_14_CUSTOMER"
  | "VALIDATE_STAGE_15_POSITIONING"
  | "VALIDATE_STAGE_16_DIFFICULTY"
  | "VALIDATE_STAGE_17_REVENUE"
  | "VALIDATE_STAGE_18_90DAYS"
  | "VALIDATE_STAGE_19_PATHS"
  | "VALIDATE_STAGE_20_DECISION";

export type BhudhiOutputType =
  | "structured_goal"
  | "reality_intelligence"
  | "task_copy"
  | "blocker_classification"
  | "clarification_request"
  | "recovery_copy"
  | "state_explanation"
  | "evidence_summary"
  | "academy_instruction"
  | "academy_skill_assessment"
  | "academy_gap_severity"
  | "root_cause_candidates"
  | "strategic_outlook"
  | "behavioral_insight"
  | "signal_narrative"
  | "restart_copy"
  | "blueprint_health"
  | "blueprint_interpretation"
  | "execution_help"
  | "identity_update"
  | "eis_competitor"
  | "eis_narrative"
  | "eis_opportunity_synthesis"
  | "eis_synthesis"
  | "erector_archetype_narrative"
  | "erector_purpose"
  | "erector_industry"
  | "erector_market"
  | "erector_competitors"
  | "erector_economy"
  | "erector_pain"
  | "erector_time_simulation"
  | "erector_paths"
  | "erector_first_week";

export interface BhudhiContextPacket {
  userId:                 string;
  blueprintId?:           string;
  triggerType:            BhudhiTriggerType;
  bhudhiMode:             BhudhiMode;
  stateVersion:           number;
  condition?:             string;
  enforcementPackageId?:  string;
  allowedActions:         string[];
  forbiddenActions:       string[];
  currentOrder?: {
    id:         string;
    type:       string;
    difficulty: string;
    proofType:  string;
    status:     string;
    title:      string;
  };
  userInput?:            string;
  systemFacts:           Record<string, unknown>;
  memoryContext?:        string;
  outputContractName:    string;
  maxTokens:             number;
}

export interface BhudhiOutputEnvelope<T = unknown> {
  outputType:               BhudhiOutputType;
  contractVersion:         string;
  stateVersion:            number;
  confidence:              "LOW" | "MEDIUM" | "HIGH";
  data:                    T;
  missingFields:           string[];
  warnings:                string[];
  forbiddenActionRequested: boolean;
}

export interface BhudhiTriggerRequest {
  sourceEngine:    string;
  triggerType:     BhudhiTriggerType;
  userId:          string;
  blueprintId?:    string;
  stateVersion:    number;
  userInput?:      string;
  facts?:          Record<string, unknown>;
  idempotencyKey:  string;
}

export interface BhudhiTriggerResult<T = unknown> {
  ok:              boolean;
  output?:         BhudhiOutputEnvelope<T>;
  fallbackUsed:    boolean;
  logId:           string;
  failureReason?:  string;
}

// ── BHUDHI PROMPT 1 — Intelligence catalog models (Drizzle-backed) ───────────
export type {
  BhudhiSystem,
  BhudhiSystemId,
  BhudhiEngine,
  BhudhiEngineType,
  BhudhiEngineMetrics,
  BhudhiFramework,
  BhudhiDomain,
  BhudhiDomainName,
  BhudhiSignal,
  BhudhiSignalMetrics,
  BhudhiFrameworkSignalEntry,
  GlobalSignal,
  BhudhiInvestigation,
  BhudhiInvestigationFindings,
  BhudhiRecommendation,
  BhudhiExpectedImpact,
  BhudhiExecutionEvent,
  BhudhiFrameworkLearning,
  BhudhiExternalConnection,
  BhudhiExternalData,
  FrameworkRole,
  InvestigationSubject,
  BhudhiExecutionEventType,
  BhudhiLearningType,
  BhudhiRecommendationIntelligenceMeta,
} from "@workspace/db/types/bhudhi";

export type {
  EnrichedRecommendation,
  FrameworkAnalysis,
} from "../bhudhi/intelligence/types.js";
export type { StoredRecommendation } from "../bhudhi/intelligence/IntelligenceService.js";
export { intelligenceService } from "../bhudhi/intelligence/IntelligenceService.js";
export { operatingService } from "../bhudhi/operating/OperatingService.js";
export type { OperatingExecutionResult } from "../bhudhi/operating/types.js";
export { OPERATING_ENGINE_NAMES } from "../bhudhi/operating/types.js";
export { signalService } from "../bhudhi/signals/SignalService.js";
export { frameworksService } from "../bhudhi/frameworks/FrameworksService.js";
export type { FrameworkEvaluationResult } from "../bhudhi/frameworks/types.js";
