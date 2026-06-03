/**
 * DOC3 canonical trigger registry (26 core + 2 Erector Category J = 28).
 * TriggerRouter gates web search and source engines from this map.
 */
import type { BhudhiMode, BhudhiTriggerType } from "../types/bhudhi.js";

export type Doc3MemoryPolicy = "allowed" | "denied";

export interface Doc3TriggerRegistryEntry {
  triggerType: BhudhiTriggerType;
  /** PromptRegistry key when an alias reuses another contract */
  promptTriggerType: BhudhiTriggerType;
  sourceEngines: string[];
  mode: BhudhiMode;
  outputContractName: string;
  timeoutMs: number;
  memoryPolicy: Doc3MemoryPolicy;
  webSearchEligible: boolean;
  fallbackKey: string;
}

const entries: Doc3TriggerRegistryEntry[] = [
  // A — Onboarding & Blueprint
  {
    triggerType: "GOAL_STRUCTURING",
    promptTriggerType: "GOAL_STRUCTURING",
    sourceEngines: ["OnboardingService"],
    mode: "STRUCTURE",
    outputContractName: "goal.structure.v1",
    timeoutMs: 15_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.goal_structure",
  },
  {
    triggerType: "BLUEPRINT_GENERATION",
    promptTriggerType: "BLUEPRINT_GENERATION",
    sourceEngines: ["BlueprintEngine"],
    mode: "STRUCTURE",
    outputContractName: "blueprint.generate.v1",
    timeoutMs: 20_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.blueprint_health",
  },
  {
    triggerType: "POLICY_GENERATION",
    promptTriggerType: "POLICY_GENERATION",
    sourceEngines: ["BlueprintEngine"],
    mode: "STRUCTURE",
    outputContractName: "policy.generate.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.policy_generation",
  },
  {
    triggerType: "DOMAIN_RESOLUTION",
    promptTriggerType: "DOMAIN_RESOLUTION",
    sourceEngines: ["DomainEngine"],
    mode: "INTERPRET",
    outputContractName: "domain.resolve.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.domain_resolution",
  },
  // B — Task Generation
  {
    triggerType: "TASK_DRAFTING",
    promptTriggerType: "TASK_DRAFTING",
    sourceEngines: ["TaskGenerationEngine"],
    mode: "DRAFT",
    outputContractName: "task.draft.v3",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.task_copy",
  },
  {
    triggerType: "TASK_REGENERATION",
    promptTriggerType: "TASK_REGENERATION",
    sourceEngines: ["TaskGenerationEngine"],
    mode: "DRAFT",
    outputContractName: "task.regenerate.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.task_copy",
  },
  {
    triggerType: "TASK_EXPLANATION",
    promptTriggerType: "TASK_EXPLANATION",
    sourceEngines: ["DashboardEngine", "TaskScreen"],
    mode: "EXPLAIN",
    outputContractName: "task.explain.v1",
    timeoutMs: 8_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.task_explanation",
  },
  // C — Feedback
  {
    triggerType: "FEEDBACK_CLASSIFICATION",
    promptTriggerType: "FEEDBACK_CLASSIFICATION",
    sourceEngines: ["FeedbackProcessingEngine"],
    mode: "INTERPRET",
    outputContractName: "feedback.blocker.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.blocker_classification",
  },
  {
    triggerType: "FEEDBACK_INTERROGATION",
    promptTriggerType: "FEEDBACK_INTERROGATION",
    sourceEngines: ["FeedbackProcessingEngine"],
    mode: "DRAFT",
    outputContractName: "feedback.interrogate.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.clarification",
  },
  {
    triggerType: "WEAK_FEEDBACK_DETECTED",
    promptTriggerType: "WEAK_FEEDBACK_DETECTED",
    sourceEngines: ["FeedbackProcessingEngine"],
    mode: "INTERPRET",
    outputContractName: "feedback.weak.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.blocker_classification",
  },
  // D — State & Condition
  {
    triggerType: "CONDITION_EXPLANATION",
    promptTriggerType: "CONDITION_EXPLANATION",
    sourceEngines: ["ConditionEvaluationEngine"],
    mode: "EXPLAIN",
    outputContractName: "condition.explain.v1",
    timeoutMs: 8_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.state_explanation",
  },
  {
    triggerType: "STATE_SUMMARY",
    promptTriggerType: "STATE_SUMMARY",
    sourceEngines: ["DashboardEngine"],
    mode: "EXPLAIN",
    outputContractName: "state.summary.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.state_explanation",
  },
  {
    triggerType: "SIGNAL_INTERPRETATION",
    promptTriggerType: "SIGNAL_INTERPRETATION",
    sourceEngines: ["SignalCalculationEngine"],
    mode: "EXPLAIN",
    outputContractName: "signal.interpret.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.signal_narrative",
  },
  // E — Recovery & Blockers
  {
    triggerType: "RECOVERY_SUGGESTION",
    promptTriggerType: "RECOVERY_SUGGESTION",
    sourceEngines: ["RecoveryEngine"],
    mode: "SUGGEST",
    outputContractName: "recovery.suggest.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.recovery_copy",
  },
  {
    triggerType: "BLOCKER_CLASSIFICATION",
    promptTriggerType: "BLOCKER_CLASSIFICATION",
    sourceEngines: ["BlockerResolutionEngine"],
    mode: "INTERPRET",
    outputContractName: "blocker.classify.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.blocker_classification",
  },
  {
    triggerType: "INACTIVITY_MESSAGE",
    promptTriggerType: "INACTIVITY_MESSAGE",
    sourceEngines: ["InactivityDetectionEngine"],
    mode: "DRAFT",
    outputContractName: "inactivity.message.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.restart_copy",
  },
  // F — Outcome & Progress
  {
    triggerType: "EVIDENCE_SUMMARY",
    promptTriggerType: "EVIDENCE_SUMMARY",
    sourceEngines: ["OutcomeValidationEngine"],
    mode: "EXPLAIN",
    outputContractName: "outcome.evidence.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.evidence_summary",
  },
  {
    triggerType: "FALSE_PROGRESS_REVIEW",
    promptTriggerType: "FALSE_PROGRESS_REVIEW",
    sourceEngines: ["FalseProgressDetectionEngine"],
    mode: "INTERPRET",
    outputContractName: "false_progress.review.v1",
    timeoutMs: 10_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.false_progress",
  },
  {
    triggerType: "OUTCOME_INTERPRETATION",
    promptTriggerType: "OUTCOME_INTERPRETATION",
    sourceEngines: ["OutcomeValidationEngine"],
    mode: "EXPLAIN",
    outputContractName: "outcome.interpret.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.evidence_summary",
  },
  // G — Behavior & Capability
  {
    triggerType: "BEHAVIOR_ANALYSIS",
    promptTriggerType: "BEHAVIOR_ANALYSIS",
    sourceEngines: ["PatternLearningEngine"],
    mode: "INTERPRET",
    outputContractName: "behavior.analyze.v1",
    timeoutMs: 10_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.behavioral_insight",
  },
  {
    triggerType: "CAPABILITY_SUMMARY",
    promptTriggerType: "CAPABILITY_SUMMARY",
    sourceEngines: ["CapabilityEngine"],
    mode: "EXPLAIN",
    outputContractName: "capability.summary.v1",
    timeoutMs: 8_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.capability_summary",
  },
  // H — Academy
  {
    triggerType: "ACADEMY_CONTENT",
    promptTriggerType: "ACADEMY_CONTENT",
    sourceEngines: ["AcademyEngine"],
    mode: "DRAFT",
    outputContractName: "academy.content.v1",
    timeoutMs: 15_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.academy_instruction",
  },
  // I — Erector validation (web search eligible except paths)
  {
    triggerType: "VALIDATION_RESEARCH_MARKET",
    promptTriggerType: "VALIDATION_RESEARCH_MARKET",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "STRUCTURE",
    outputContractName: "validation.market.v1",
    timeoutMs: 30_000,
    memoryPolicy: "denied",
    webSearchEligible: true,
    fallbackKey: "fallback.validation_market",
  },
  {
    triggerType: "VALIDATION_RESEARCH_COMPETITORS",
    promptTriggerType: "VALIDATION_RESEARCH_COMPETITORS",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "STRUCTURE",
    outputContractName: "validation.competitors.v1",
    timeoutMs: 30_000,
    memoryPolicy: "denied",
    webSearchEligible: true,
    fallbackKey: "fallback.validation_competitors",
  },
  {
    triggerType: "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
    promptTriggerType: "VALIDATION_COMPETITOR_DEEP_ANALYSIS",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "INTERPRET",
    outputContractName: "validation.competitor_deep.v1",
    timeoutMs: 45_000,
    memoryPolicy: "denied",
    webSearchEligible: true,
    fallbackKey: "fallback.validation_competitor_deep",
  },
  {
    triggerType: "VALIDATION_GENERATE_EXPLANATIONS",
    promptTriggerType: "VALIDATION_GENERATE_EXPLANATIONS",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "EXPLAIN",
    outputContractName: "validation.explanations.v1",
    timeoutMs: 20_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.validation_explanations",
  },
  {
    triggerType: "BLUEPRINT_TIER_PREVIEW",
    promptTriggerType: "BLUEPRINT_TIER_PREVIEW",
    sourceEngines: ["TIER_PREVIEW_ENGINE"],
    mode: "STRUCTURE",
    outputContractName: "blueprint.tier_preview.v1",
    timeoutMs: 20_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.blueprint_tier_preview",
  },
  {
    triggerType: "VALIDATION_ANALYZE_DEMAND",
    promptTriggerType: "VALIDATION_ANALYZE_DEMAND",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "INTERPRET",
    outputContractName: "validation.demand.v1",
    timeoutMs: 25_000,
    memoryPolicy: "denied",
    webSearchEligible: true,
    fallbackKey: "fallback.validation_demand",
  },
  {
    triggerType: "VALIDATION_BUILD_PATHS",
    promptTriggerType: "VALIDATION_BUILD_PATHS",
    sourceEngines: ["ValidationResearchEngine"],
    mode: "STRUCTURE",
    outputContractName: "validation.paths.v1",
    timeoutMs: 20_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.validation_paths",
  },
  // J — Erector Academy + Simulation
  {
    triggerType: "ERECTOR_ACADEMY_CONTENT",
    promptTriggerType: "ERECTOR_ACADEMY_CONTENT",
    sourceEngines: ["ErectorAcademyEngine"],
    mode: "DRAFT",
    outputContractName: "erector.academy.v1",
    timeoutMs: 15_000,
    memoryPolicy: "allowed",
    webSearchEligible: false,
    fallbackKey: "fallback.academy_instruction",
  },
  {
    triggerType: "ERECTOR_SIMULATION_EVENT",
    promptTriggerType: "ERECTOR_SIMULATION_EVENT",
    sourceEngines: ["ErectorSimulationEngine"],
    mode: "DRAFT",
    outputContractName: "erector.simulation.v1",
    timeoutMs: 10_000,
    memoryPolicy: "denied",
    webSearchEligible: false,
    fallbackKey: "fallback.erector_simulation",
  },
];

const registry = new Map<BhudhiTriggerType, Doc3TriggerRegistryEntry>(
  entries.map((e) => [e.triggerType, e]),
);

/** DOC3 Categories A–I (26 triggers). */
export const DOC3_CORE_TRIGGER_COUNT = 26;

export function getDoc3TriggerEntry(
  triggerType: BhudhiTriggerType,
): Doc3TriggerRegistryEntry | null {
  return registry.get(triggerType) ?? null;
}

export function getDoc3TriggerRegistry(): ReadonlyMap<BhudhiTriggerType, Doc3TriggerRegistryEntry> {
  return registry;
}

export function isDoc3RegisteredTrigger(triggerType: BhudhiTriggerType): boolean {
  return registry.has(triggerType);
}

export function listDoc3TriggerTypes(): BhudhiTriggerType[] {
  return [...registry.keys()];
}
