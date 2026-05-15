import { bhudhiTriggerTypeEnum } from "@workspace/db";
import type { BhudhiTriggerType } from "../types/bhudhi.js";

type DbBhudhiTrigger = (typeof bhudhiTriggerTypeEnum.enumValues)[number];

/** Maps valid Bhudhi contracts to existing Postgres `bhudhi_trigger_type` enum values. */
export function mapBhudhiTriggerToDbEnum(triggerType: BhudhiTriggerType): DbBhudhiTrigger {
  const m: Record<BhudhiTriggerType, DbBhudhiTrigger> = {
    GOAL_STRUCTURING:         "goal_structuring",
    REALITY_INTELLIGENCE:     "goal_structuring",
    TASK_DRAFTING:            "task_generation",
    FEEDBACK_CLASSIFICATION:  "blocker_classification",
    CLARIFICATION_PROMPT:     "feedback_interrogation",
    RECOVERY_COPY:            "condition_explanation",
    STATE_EXPLANATION:        "state_explanation",
    INACTIVITY_RESTART:       "pattern_summary",
    ACADEMY_SUPPORT:          "academy_content",
    OUTCOME_EVIDENCE_SUMMARY: "evidence_summary",
    ROOT_CAUSE_ASSIST:        "root_cause_candidates",
  };
  return m[triggerType];
}

export const VALIDATION_PATHS_LOG_TRIGGER = "validation_analysis" as DbBhudhiTrigger;
