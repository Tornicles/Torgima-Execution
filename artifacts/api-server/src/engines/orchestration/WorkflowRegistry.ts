/**
 * DOC28 Task 2 — canonical workflow registry (3 governed workflows).
 */

import { EventTypes } from "../../types/eventContracts.js";

export type RetryPolicy = "STANDARD" | "FAST" | "CRITICAL";

export type RegistryWorkflowStep = {
  stepName: string;
  engine: string;
  consumesEvent: string;
  emitsSuccessEvent: string;
  required: boolean;
  retryPolicy: RetryPolicy;
  fallbackStep?: string;
};

export type RegistryWorkflow = {
  name: string;
  triggerEvents: string[];
  lockScope: "USER" | "BLUEPRINT" | "ORDER" | "NONE";
  requiredStateVersion: boolean;
  steps: RegistryWorkflowStep[];
  terminalEvents: string[];
};

export const WORKFLOWS = {
  FEEDBACK_COMPLETION: {
    name: "feedback_completion_loop",
    triggerEvents: [EventTypes.FEEDBACK_SUBMITTED, EventTypes.FEEDBACK_SUBMITTED_PARTIAL],
    lockScope: "BLUEPRINT",
    requiredStateVersion: true,
    steps: [
      {
        stepName: "signal_recalculation",
        engine: "SignalCalculationEngine",
        consumesEvent: EventTypes.FEEDBACK_SUBMITTED,
        emitsSuccessEvent: EventTypes.SIGNAL_CALCULATED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "condition_evaluation",
        engine: "ConditionEvaluationEngine",
        consumesEvent: EventTypes.SIGNAL_CALCULATED,
        emitsSuccessEvent: EventTypes.CONDITION_EVALUATED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "erector_signal_bridge",
        engine: "ErectorSignalBridgeWorker",
        consumesEvent: EventTypes.SIGNAL_CALCULATED,
        emitsSuccessEvent: EventTypes.ERECTOR_SIGNAL_CALCULATED,
        required: false,
        retryPolicy: "FAST",
      },
      {
        stepName: "enforcement_generation",
        engine: "ControlEngine",
        consumesEvent: EventTypes.CONDITION_EVALUATED,
        emitsSuccessEvent: EventTypes.ENFORCEMENT_PACKAGE_CREATED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "task_generation",
        engine: "TaskGenerationEngine",
        consumesEvent: EventTypes.ENFORCEMENT_PACKAGE_CREATED,
        emitsSuccessEvent: EventTypes.TASK_GENERATION_COMPLETED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "dependency_check",
        engine: "DependencyEngine",
        consumesEvent: EventTypes.TASK_GENERATION_COMPLETED,
        emitsSuccessEvent: EventTypes.DEPENDENCY_CHECK_REQUESTED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "priority_selection",
        engine: "PriorityEngine",
        consumesEvent: EventTypes.DEPENDENCY_CHECK_REQUESTED,
        emitsSuccessEvent: EventTypes.PRIORITY_REVIEW_REQUESTED,
        required: false,
        retryPolicy: "FAST",
        fallbackStep: "skip_to_guarantee",
      },
      {
        stepName: "task_guarantee",
        engine: "ContinuousTaskGuaranteeEngine",
        consumesEvent: EventTypes.PRIORITY_REVIEW_REQUESTED,
        emitsSuccessEvent: EventTypes.ORDER_AVAILABLE,
        required: true,
        retryPolicy: "CRITICAL",
      },
      {
        stepName: "reward_evaluation",
        engine: "RewardEngine",
        consumesEvent: EventTypes.FEEDBACK_SUBMITTED,
        emitsSuccessEvent: EventTypes.REWARD_CREATED,
        required: false,
        retryPolicy: "FAST",
      },
      {
        stepName: "identity_evaluation",
        engine: "IdentityEngine",
        consumesEvent: EventTypes.FEEDBACK_SUBMITTED,
        emitsSuccessEvent: EventTypes.IDENTITY_UPDATED,
        required: false,
        retryPolicy: "FAST",
      },
      {
        stepName: "pattern_scan",
        engine: "PatternLearningEngine",
        consumesEvent: EventTypes.FEEDBACK_SUBMITTED,
        emitsSuccessEvent: EventTypes.PATTERN_SCAN_REQUESTED,
        required: false,
        retryPolicy: "FAST",
      },
    ],
    terminalEvents: [EventTypes.ORDER_AVAILABLE, EventTypes.TASK_GUARANTEE_REQUESTED],
  },
  INACTIVITY_DETECTION: {
    name: "inactivity_detection_workflow",
    triggerEvents: [EventTypes.INACTIVITY_SCAN_REQUESTED],
    lockScope: "USER",
    requiredStateVersion: false,
    steps: [
      {
        stepName: "detect_inactivity",
        engine: "InactivityDetectionEngine",
        consumesEvent: EventTypes.INACTIVITY_SCAN_REQUESTED,
        emitsSuccessEvent: EventTypes.INACTIVITY_DETECTED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "recovery_task_generation",
        engine: "TaskGenerationEngine",
        consumesEvent: EventTypes.INACTIVITY_DETECTED,
        emitsSuccessEvent: EventTypes.TASK_GENERATION_COMPLETED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "identity_regression_check",
        engine: "IdentityEngine",
        consumesEvent: EventTypes.INACTIVITY_DETECTED,
        emitsSuccessEvent: EventTypes.IDENTITY_UPDATED,
        required: false,
        retryPolicy: "FAST",
      },
    ],
    terminalEvents: [EventTypes.ORDER_AVAILABLE, EventTypes.INACTIVITY_RESOLVED],
  },
  FAILURE_CORRECTION: {
    name: "failure_correction_workflow",
    triggerEvents: [EventTypes.FEEDBACK_FAILED, EventTypes.FEEDBACK_BLOCKED],
    lockScope: "BLUEPRINT",
    requiredStateVersion: true,
    steps: [
      {
        stepName: "failure_classification",
        engine: "FailureClassificationEngine",
        consumesEvent: EventTypes.FAILURE_CLASSIFICATION_REQUESTED,
        emitsSuccessEvent: EventTypes.FAILURE_CLASSIFIED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "friction_detection",
        engine: "FrictionDetectionEngine",
        consumesEvent: EventTypes.FAILURE_CLASSIFIED,
        emitsSuccessEvent: EventTypes.FRICTION_ADAPTATION_REQUESTED,
        required: false,
        retryPolicy: "FAST",
      },
      {
        stepName: "dependency_check",
        engine: "DependencyEngine",
        consumesEvent: EventTypes.FAILURE_CLASSIFIED,
        emitsSuccessEvent: EventTypes.DEPENDENCY_CHECK_REQUESTED,
        required: false,
        retryPolicy: "FAST",
      },
      {
        stepName: "correction_task",
        engine: "TaskGenerationEngine",
        consumesEvent: EventTypes.FRICTION_ADAPTATION_REQUESTED,
        emitsSuccessEvent: EventTypes.TASK_GENERATION_COMPLETED,
        required: true,
        retryPolicy: "STANDARD",
      },
      {
        stepName: "task_guarantee",
        engine: "ContinuousTaskGuaranteeEngine",
        consumesEvent: EventTypes.TASK_GENERATION_COMPLETED,
        emitsSuccessEvent: EventTypes.ORDER_AVAILABLE,
        required: true,
        retryPolicy: "CRITICAL",
      },
    ],
    terminalEvents: [EventTypes.ORDER_AVAILABLE, EventTypes.ERECTOR_CORRECTION_PATH_OPENED],
  },
} as const satisfies Record<string, RegistryWorkflow>;

export type WorkflowRegistryName = keyof typeof WORKFLOWS;

export function getWorkflow(name: WorkflowRegistryName): RegistryWorkflow {
  return WORKFLOWS[name];
}

export function listWorkflows(): RegistryWorkflow[] {
  return Object.values(WORKFLOWS);
}

export function requiredCoreSteps(workflow: RegistryWorkflow): RegistryWorkflowStep[] {
  return workflow.steps.filter((step) => step.required);
}

export function optionalSteps(workflow: RegistryWorkflow): RegistryWorkflowStep[] {
  return workflow.steps.filter((step) => !step.required);
}

/** Map DOC28 registry workflow to legacy WorkflowDefinitions shape. */
export function toLegacyWorkflowDefinition(workflow: RegistryWorkflow): {
  name: string;
  lockScope: RegistryWorkflow["lockScope"];
  steps: Array<{ name: string; emits: string; required: boolean }>;
} {
  return {
    name: workflow.name.replace(/_workflow$|_loop$/, ""),
    lockScope: workflow.lockScope,
    steps: workflow.steps.map((step) => ({
      name: step.stepName,
      emits: step.emitsSuccessEvent,
      required: step.required,
    })),
  };
}
