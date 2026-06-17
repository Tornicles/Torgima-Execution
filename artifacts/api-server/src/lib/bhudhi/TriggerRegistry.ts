import type { BhudhiMode, BhudhiOutputType } from "../../types/bhudhi.js";

export interface Doc12TriggerDefinition {
  mode: BhudhiMode;
  allowedSources: readonly string[];
  requiredContext: readonly string[];
  forbiddenContext: readonly string[];
  maxTokens: number;
  timeoutMs: number;
  outputType: BhudhiOutputType;
}

/** Core DOC12 router triggers — use BhudhiTriggerRouter path. */
export const CORE_DOC12_ROUTER_TRIGGERS = {
  GOAL_STRUCTURING: {
    mode: "STRUCTURE",
    allowedSources: ["ONBOARDING", "BHUDHI_WORKER", "OnboardingService", "TriggerRouter"],
    requiredContext: ["raw_goal", "raw_purpose", "tier"],
    forbiddenContext: ["signal_scores", "condition_records", "enforcement_packages"],
    maxTokens: 800,
    timeoutMs: 12_000,
    outputType: "structured_goal",
  },
  TASK_DRAFTING: {
    mode: "DRAFT",
    allowedSources: ["TASK_GENERATION", "TaskGenerationEngine", "INTERNAL_WORKER", "TriggerRouter"],
    requiredContext: ["action_type", "domain", "condition", "tier"],
    forbiddenContext: ["raw_enforcement_package", "signal_calculation_formula"],
    maxTokens: 600,
    timeoutMs: 10_000,
    outputType: "task_copy",
  },
  BLOCKER_CLASSIFICATION: {
    mode: "INTERPRET",
    allowedSources: [
      "FEEDBACK_PROCESSING",
      "FeedbackProcessingEngine",
      "BlockerResolutionEngine",
      "TriggerRouter",
    ],
    requiredContext: ["blocker_description", "task_type"],
    forbiddenContext: ["user_history", "signal_scores"],
    maxTokens: 300,
    timeoutMs: 8_000,
    outputType: "blocker_classification",
  },
  CLARIFICATION_PROMPT: {
    mode: "DRAFT",
    allowedSources: ["FEEDBACK_PROCESSING", "FeedbackProcessingEngine", "TASK_GENERATION", "TaskGenerationEngine"],
    requiredContext: ["missing_field", "task_title"],
    forbiddenContext: ["enforcement_package_id"],
    maxTokens: 200,
    timeoutMs: 6_000,
    outputType: "clarification_request",
  },
  STATE_EXPLANATION: {
    mode: "EXPLAIN",
    allowedSources: ["DASHBOARD", "DashboardEngine", "INTERNAL_WORKER", "TriggerRouter"],
    requiredContext: ["condition", "signal_summary", "next_action"],
    forbiddenContext: ["raw_db_records", "enforcement_package_id"],
    maxTokens: 400,
    timeoutMs: 8_000,
    outputType: "state_explanation",
  },
  RECOVERY_COPY: {
    mode: "DRAFT",
    allowedSources: [
      "TASK_GENERATION",
      "TaskGenerationEngine",
      "INACTIVITY_DETECTION",
      "InactivityDetectionEngine",
      "RecoveryEngine",
    ],
    requiredContext: ["inactivity_type", "days_inactive", "tier"],
    forbiddenContext: ["raw_pattern_data", "signal_formula"],
    maxTokens: 300,
    timeoutMs: 8_000,
    outputType: "recovery_copy",
  },
  ACADEMY_SUPPORT: {
    mode: "EXPLAIN",
    allowedSources: ["TASK_GENERATION", "TaskGenerationEngine", "ACADEMY_RUNTIME", "AcademyEngine"],
    requiredContext: ["capability_name", "domain", "learning_type"],
    forbiddenContext: [],
    maxTokens: 600,
    timeoutMs: 10_000,
    outputType: "academy_instruction",
  },
  ROOT_CAUSE_ASSIST: {
    mode: "SUGGEST",
    allowedSources: ["FAILURE_CLASSIFICATION", "FailureClassificationEngine"],
    requiredContext: ["failure_evidence", "task_type", "condition"],
    forbiddenContext: ["user_personal_notes"],
    maxTokens: 400,
    timeoutMs: 8_000,
    outputType: "root_cause_candidates",
  },
  OUTCOME_EVIDENCE_SUMMARY: {
    mode: "EXPLAIN",
    allowedSources: [
      "OUTCOME_VALIDATION",
      "OutcomeValidationEngine",
      "INTERNAL_WORKER",
      "TriggerRouter",
    ],
    requiredContext: ["evidence_class", "evidence_summary", "target_metric"],
    forbiddenContext: ["raw_evidence_files"],
    maxTokens: 300,
    timeoutMs: 8_000,
    outputType: "evidence_summary",
  },
  PROOF_RELEVANCE_CHECK: {
    mode: "INTERPRET",
    allowedSources: ["FEEDBACK_PROCESSING", "FeedbackProcessingEngine"],
    requiredContext: ["proof_description", "task_title", "expected_output"],
    forbiddenContext: [],
    maxTokens: 200,
    timeoutMs: 6_000,
    outputType: "proof_relevance",
  },
} as const satisfies Record<string, Doc12TriggerDefinition>;

/** Erector intelligence triggers — canonical registry entries routed via runBhudhiPipeline. */
export const ERECTOR_CANONICAL_TRIGGERS = {
  ERECTOR_FREE_VALIDATION: {
    mode: "INTERPRET",
    allowedSources: ["erector_free", "INTERNAL", "TriggerRouter"],
    requiredContext: ["industry", "goal"],
    forbiddenContext: [],
    maxTokens: 2000,
    timeoutMs: 15_000,
    outputType: "erector_free_report",
  },
  ERECTOR_PAID_VALIDATION: {
    mode: "STRUCTURE",
    allowedSources: ["erector_paid", "INTERNAL", "TriggerRouter"],
    requiredContext: ["goal"],
    forbiddenContext: [],
    maxTokens: 4000,
    timeoutMs: 30_000,
    outputType: "erector_paid_report",
  },
  ERECTOR_FREE_VERDICT_EXPLAIN: {
    mode: "EXPLAIN",
    allowedSources: ["erector_rule_engine", "INTERNAL", "TriggerRouter"],
    requiredContext: ["verdict"],
    forbiddenContext: [],
    maxTokens: 500,
    timeoutMs: 10_000,
    outputType: "erector_verdict_explanation",
  },
  ERECTOR_VERDICT_EXPLAIN: {
    mode: "EXPLAIN",
    allowedSources: ["erector_rule_engine", "INTERNAL", "TriggerRouter"],
    requiredContext: ["verdict"],
    forbiddenContext: [],
    maxTokens: 800,
    timeoutMs: 10_000,
    outputType: "erector_verdict_explanation",
  },
  ERECTOR_STATE_EXPLANATION: {
    mode: "EXPLAIN",
    allowedSources: ["erector_validation", "INTERNAL", "TriggerRouter"],
    requiredContext: ["verdict"],
    forbiddenContext: [],
    maxTokens: 600,
    timeoutMs: 10_000,
    outputType: "state_explanation",
  },
} as const satisfies Record<string, Doc12TriggerDefinition>;

/** Unified canonical Bhudhi trigger registry (Doc12 core + Erector). */
export const REGISTERED_TRIGGERS = {
  ...CORE_DOC12_ROUTER_TRIGGERS,
  ...ERECTOR_CANONICAL_TRIGGERS,
} as const;

export type Doc12TriggerType = keyof typeof CORE_DOC12_ROUTER_TRIGGERS;
export type ErectorCanonicalTriggerType = keyof typeof ERECTOR_CANONICAL_TRIGGERS;
export type CanonicalBhudhiTriggerType = keyof typeof REGISTERED_TRIGGERS;

/** Legacy alias — canonical name is ERECTOR_VERDICT_EXPLAIN. */
export const BHUDHI_TRIGGER_ALIASES: Partial<Record<string, CanonicalBhudhiTriggerType>> = {
  ERECTOR_VERDICT_EXPLANATION: "ERECTOR_VERDICT_EXPLAIN",
};

export function resolveCanonicalTriggerType(triggerType: string): string {
  return BHUDHI_TRIGGER_ALIASES[triggerType] ?? triggerType;
}

export function isRegisteredBhudhiTrigger(
  triggerType: string,
): triggerType is CanonicalBhudhiTriggerType {
  const resolved = resolveCanonicalTriggerType(triggerType);
  return resolved in REGISTERED_TRIGGERS;
}

export function usesDoc12Router(triggerType: string): triggerType is Doc12TriggerType {
  const resolved = resolveCanonicalTriggerType(triggerType);
  return resolved in CORE_DOC12_ROUTER_TRIGGERS;
}

export function isDoc12Trigger(triggerType: string): triggerType is Doc12TriggerType {
  return usesDoc12Router(triggerType);
}

export const CORE_DOC12_TRIGGER_COUNT = Object.keys(CORE_DOC12_ROUTER_TRIGGERS).length;

export const ERECTOR_TRIGGER_TYPES = Object.keys(
  ERECTOR_CANONICAL_TRIGGERS,
) as ErectorCanonicalTriggerType[];

export function getDoc12Trigger(triggerType: string): Doc12TriggerDefinition | null {
  if (!isDoc12Trigger(triggerType)) return null;
  return CORE_DOC12_ROUTER_TRIGGERS[triggerType];
}

export function isSourceAllowedForTrigger(triggerType: Doc12TriggerType, sourceEngine: string): boolean {
  return (CORE_DOC12_ROUTER_TRIGGERS[triggerType].allowedSources as readonly string[]).includes(
    sourceEngine,
  );
}
