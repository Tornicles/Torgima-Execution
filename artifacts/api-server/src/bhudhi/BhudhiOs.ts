/**
 * Bhudhi Operating System — 7 intelligence zones (governance hierarchy enforced).
 */
import type { BhudhiTriggerType } from "../types/bhudhi.js";

export type BhudhiOsZone =
  | "realityIntelligence"
  | "executionIntelligence"
  | "feedbackIntelligence"
  | "signalIntelligence"
  | "adaptationIntelligence"
  | "knowledgeIntelligence"
  | "governanceIntelligence";

export const BHUDHI_OS = {
  realityIntelligence: {
    triggers: [
      "ERECTOR_MARKET_ANALYZE",
      "ERECTOR_COMPETITORS_IDENTIFY",
      "ERECTOR_ECONOMY_BRIEFING",
      "VALIDATE_STAGE_5_TIMING",
    ],
    modes: ["economy_briefing", "market_depth", "competitor_profile", "opportunity_map"],
    outputValidation: "RealityIntelligenceSchema",
    canSearchWeb: true,
    timeout: 30_000,
  },
  executionIntelligence: {
    triggers: [
      "BLUEPRINT_GENERATION",
      "TASK_DRAFTING",
      "TASK_GENERATION",
      "RECOVERY_COPY",
    ],
    modes: ["blueprint_architect", "task_generator", "recovery_generator", "academy_generator"],
    outputValidation: "ExecutionIntelligenceSchema",
    canSearchWeb: false,
    timeout: 8_000,
  },
  feedbackIntelligence: {
    triggers: ["FEEDBACK_CLASSIFICATION", "ROOT_CAUSE_ASSIST", "BEHAVIORAL_INSIGHT"],
    modes: ["feedback_analyzer", "interrogation_generator", "pattern_detector"],
    outputValidation: "FeedbackIntelligenceSchema",
    canSearchWeb: false,
    timeout: 5_000,
  },
  signalIntelligence: {
    triggers: ["STATE_EXPLANATION", "SIGNAL_EXPLANATION"],
    modes: ["signal_explainer", "condition_narrator", "trajectory_predictor"],
    outputValidation: "SignalIntelligenceSchema",
    canSearchWeb: false,
    timeout: 5_000,
  },
  adaptationIntelligence: {
    triggers: ["INACTIVITY_RESTART", "RECOVERY_COPY"],
    modes: ["pivot_analyzer", "strategy_adjuster", "recovery_planner"],
    outputValidation: "AdaptationIntelligenceSchema",
    canSearchWeb: false,
    timeout: 10_000,
  },
  knowledgeIntelligence: {
    triggers: ["ACADEMY_SUPPORT", "OUTCOME_EVIDENCE_SUMMARY"],
    modes: ["sop_generator", "benchmark_creator", "toolbox_builder", "failure_pattern_extractor"],
    outputValidation: "KnowledgeIntelligenceSchema",
    canSearchWeb: false,
    timeout: 10_000,
  },
  governanceIntelligence: {
    triggers: ["GOVERNANCE_CHECK", "OUTCOME_EVIDENCE_SUMMARY"],
    modes: ["rule_explainer", "restriction_narrator", "compliance_checker"],
    outputValidation: "GovernanceIntelligenceSchema",
    canSearchWeb: false,
    timeout: 3_000,
  },
} as const;

const TRIGGER_TO_ZONE = new Map<string, BhudhiOsZone>();

for (const [zone, cfg] of Object.entries(BHUDHI_OS)) {
  for (const t of cfg.triggers) {
    TRIGGER_TO_ZONE.set(t, zone as BhudhiOsZone);
  }
}

export function getBhudhiOsZone(triggerType: BhudhiTriggerType | string): BhudhiOsZone {
  return TRIGGER_TO_ZONE.get(triggerType) ?? "executionIntelligence";
}

export function getBhudhiOsTimeout(triggerType: BhudhiTriggerType | string): number {
  const zone = getBhudhiOsZone(triggerType);
  return BHUDHI_OS[zone].timeout;
}

export function bhudhiOsAllowsWebSearch(triggerType: BhudhiTriggerType | string): boolean {
  const zone = getBhudhiOsZone(triggerType);
  return BHUDHI_OS[zone].canSearchWeb;
}
