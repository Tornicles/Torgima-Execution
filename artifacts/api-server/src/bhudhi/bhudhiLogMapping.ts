import { bhudhiTriggerTypeEnum } from "@workspace/db";
import type { BhudhiTriggerType } from "../types/bhudhi.js";

type DbBhudhiTrigger = (typeof bhudhiTriggerTypeEnum.enumValues)[number];

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
