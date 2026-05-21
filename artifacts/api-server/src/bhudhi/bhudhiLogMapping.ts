import { bhudhiRequestTypeEnum, bhudhiTriggerTypeEnum } from "@workspace/db";
import type { BhudhiTriggerType } from "../types/bhudhi.js";

type DbBhudhiTrigger = (typeof bhudhiTriggerTypeEnum.enumValues)[number];
type DbBhudhiRequestType = (typeof bhudhiRequestTypeEnum.enumValues)[number];

/** Maps governed triggers to legacy `bhudhi_request_type` values (B5 audit / G9 item 13). */
export function mapBhudhiTriggerToRequestType(
  triggerType: BhudhiTriggerType,
  opts?: { sourceEngine?: string },
): DbBhudhiRequestType {
  if (opts?.sourceEngine === "DASHBOARD" && triggerType === "STATE_EXPLANATION") {
    return "dashboard_summary";
  }

  const m: Record<BhudhiTriggerType, DbBhudhiRequestType> = {
    GOAL_STRUCTURING: "goal_validation",
    REALITY_INTELLIGENCE: "goal_validation",
    EIS_INDUSTRY_RESEARCH: "goal_validation",
    EIS_COMPETITOR_INTELLIGENCE: "goal_validation",
    EIS_NARRATIVE_INTELLIGENCE: "goal_validation",
    EIS_OPPORTUNITY_SYNTHESIS: "goal_validation",
    EIS_SYNTHESIS: "goal_validation",
    DOMAIN_RESOLUTION: "goal_validation",
    BLUEPRINT_GENERATION: "blueprint_generation",
    BLUEPRINT_INTERPRETATION: "blueprint_generation",
    TASK_DRAFTING: "task_generation",
    EXECUTION_SUPPORT: "task_generation",
    FEEDBACK_CLASSIFICATION: "feedback_interpretation",
    CLARIFICATION_PROMPT: "feedback_interrogation",
    RECOVERY_COPY: "recovery_suggestion",
    STATE_EXPLANATION: "condition_explanation",
    INACTIVITY_RESTART: "recovery_suggestion",
    ACADEMY_SUPPORT: "academy_content",
    ACADEMY_SKILL_ASSESSMENT: "academy_content",
    ACADEMY_GAP_SEVERITY: "academy_content",
    OUTCOME_EVIDENCE_SUMMARY: "behavior_analysis",
    ROOT_CAUSE_ASSIST: "behavior_analysis",
    DIRECTION_ANALYSIS: "condition_explanation",
    BEHAVIORAL_INSIGHT: "behavior_analysis",
    SIGNAL_NARRATIVE: "condition_explanation",
    BEHAVIORAL_ANALYSIS: "behavior_analysis",
    ERECTOR_ARCHETYPE_NARRATIVE: "blueprint_generation",
    ERECTOR_PURPOSE_DECOMPOSE: "blueprint_generation",
    ERECTOR_INDUSTRY_ANALYZE: "blueprint_generation",
    ERECTOR_MARKET_ANALYZE: "blueprint_generation",
    ERECTOR_COMPETITORS_IDENTIFY: "blueprint_generation",
    ERECTOR_ECONOMY_BRIEFING: "blueprint_generation",
    ERECTOR_PAIN_ANALYZE: "blueprint_generation",
    ERECTOR_SIMULATE_TIMEFRAMES: "blueprint_generation",
    ERECTOR_PATHS_GENERATE: "blueprint_generation",
    ERECTOR_FIRST_WEEK: "blueprint_generation",
  };

  return m[triggerType] ?? "other";
}

/** Maps valid Bhudhi contracts to existing Postgres `bhudhi_trigger_type` enum values. */
export function mapBhudhiTriggerToDbEnum(triggerType: BhudhiTriggerType): DbBhudhiTrigger {
  const m: Record<BhudhiTriggerType, DbBhudhiTrigger> = {
    GOAL_STRUCTURING:         "goal_structuring",
    REALITY_INTELLIGENCE:     "goal_structuring",
    EIS_INDUSTRY_RESEARCH:    "validation_analysis",
    EIS_COMPETITOR_INTELLIGENCE: "validation_analysis",
    EIS_NARRATIVE_INTELLIGENCE: "validation_analysis",
    EIS_OPPORTUNITY_SYNTHESIS: "validation_analysis",
    TASK_DRAFTING:            "task_generation",
    FEEDBACK_CLASSIFICATION:  "blocker_classification",
    CLARIFICATION_PROMPT:     "feedback_interrogation",
    RECOVERY_COPY:            "condition_explanation",
    STATE_EXPLANATION:        "state_explanation",
    INACTIVITY_RESTART:       "pattern_summary",
    ACADEMY_SUPPORT:          "academy_content",
    ACADEMY_SKILL_ASSESSMENT: "academy_content",
    ACADEMY_GAP_SEVERITY:     "academy_content",
    OUTCOME_EVIDENCE_SUMMARY: "evidence_summary",
    ROOT_CAUSE_ASSIST:        "root_cause_candidates",
    DIRECTION_ANALYSIS:       "state_explanation",
    BEHAVIORAL_INSIGHT:       "pattern_summary",
    SIGNAL_NARRATIVE:         "state_explanation",
    BLUEPRINT_GENERATION:     "blueprint_generation",
    BLUEPRINT_INTERPRETATION: "blueprint_interpretation",
    DOMAIN_RESOLUTION:        "validation_analysis",
    EXECUTION_SUPPORT:        "task_generation",
    BEHAVIORAL_ANALYSIS:      "pattern_summary",
    EIS_SYNTHESIS:            "validation_analysis",
    ERECTOR_ARCHETYPE_NARRATIVE: "erector_analysis",
    ERECTOR_PURPOSE_DECOMPOSE: "erector_analysis",
    ERECTOR_INDUSTRY_ANALYZE: "erector_analysis",
    ERECTOR_MARKET_ANALYZE: "erector_analysis",
    ERECTOR_COMPETITORS_IDENTIFY: "erector_analysis",
    ERECTOR_ECONOMY_BRIEFING: "erector_analysis",
    ERECTOR_PAIN_ANALYZE: "erector_analysis",
    ERECTOR_SIMULATE_TIMEFRAMES: "erector_analysis",
    ERECTOR_PATHS_GENERATE: "erector_analysis",
    ERECTOR_FIRST_WEEK: "erector_analysis",
  };
  return m[triggerType];
}

export const VALIDATION_PATHS_LOG_TRIGGER = "validation_analysis" as DbBhudhiTrigger;
