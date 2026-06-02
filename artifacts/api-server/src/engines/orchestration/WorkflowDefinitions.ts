import { EventTypes } from "../../types/eventContracts.js";

export type WorkflowLockScope = "BLUEPRINT" | "USER" | "ORDER" | "EVENT_CHAIN" | "NONE";

export interface WorkflowStep {
  name: string;
  emits: (typeof EventTypes)[keyof typeof EventTypes];
  required: boolean;
}

export interface WorkflowDefinition {
  name: string;
  lockScope: WorkflowLockScope;
  steps: WorkflowStep[];
}

/** Living record of DOC_28 workflow specs (GAP G1). Uses live event type names. */
export const Workflows = {
  FEEDBACK_COMPLETION: {
    name: "feedback_completion",
    lockScope: "BLUEPRINT",
    steps: [
      { name: "feedback_processing",    emits: EventTypes.FEEDBACK_SUBMITTED,            required: true },
      { name: "signal_recalculation",   emits: EventTypes.SIGNAL_RECALCULATION_REQUESTED, required: true },
      { name: "signal_calculation",     emits: EventTypes.SIGNAL_CALCULATED,             required: true },
      { name: "condition_evaluation",   emits: EventTypes.CONDITION_EVALUATED,           required: true },
      { name: "enforcement_package",    emits: EventTypes.ENFORCEMENT_PACKAGE_CREATED, required: true },
      { name: "task_generation",        emits: EventTypes.TASK_GENERATION_COMPLETED,   required: true },
      { name: "task_guarantee",         emits: EventTypes.ORDER_AVAILABLE,             required: true },
      { name: "dashboard_refresh",      emits: EventTypes.DASHBOARD_REFRESH_REQUESTED, required: true },
      { name: "reward_check",           emits: EventTypes.REWARD_EVALUATION_REQUESTED, required: false },
      { name: "identity_update",        emits: EventTypes.IDENTITY_EVALUATION_REQUESTED, required: false },
    ],
  },
  BLUEPRINT_LAUNCH: {
    name: "blueprint_launch",
    lockScope: "BLUEPRINT",
    steps: [
      { name: "blueprint_activation",  emits: EventTypes.BLUEPRINT_LAUNCHED,            required: true },
      { name: "task_generation",        emits: EventTypes.TASK_GENERATION_COMPLETED,   required: true },
      { name: "task_guarantee",         emits: EventTypes.ORDER_AVAILABLE,             required: true },
      { name: "dashboard_refresh",      emits: EventTypes.DASHBOARD_REFRESH_REQUESTED, required: true },
    ],
  },
  INACTIVITY_RESPONSE: {
    name: "inactivity_response",
    lockScope: "BLUEPRINT",
    steps: [
      { name: "inactivity_classification", emits: EventTypes.INACTIVITY_DETECTED,        required: true },
      { name: "signal_update",           emits: EventTypes.SIGNAL_RECALCULATION_REQUESTED, required: true },
      { name: "signal_calculation",      emits: EventTypes.SIGNAL_CALCULATED,          required: true },
      { name: "condition_evaluation",    emits: EventTypes.CONDITION_EVALUATED,        required: true },
      { name: "enforcement_adjustment",  emits: EventTypes.ENFORCEMENT_PACKAGE_CREATED, required: false },
      { name: "recovery_task_generation", emits: EventTypes.TASK_GENERATION_COMPLETED, required: true },
      { name: "task_guarantee",          emits: EventTypes.ORDER_AVAILABLE,            required: true },
      { name: "dashboard_refresh",       emits: EventTypes.DASHBOARD_REFRESH_REQUESTED, required: true },
      { name: "identity_update",         emits: EventTypes.IDENTITY_EVALUATION_REQUESTED, required: false },
      { name: "pattern_scan",            emits: EventTypes.PATTERN_SCAN_REQUESTED,     required: false },
    ],
  },
  /** Workflow 3 — failure / blocker correction path (DOC 28). */
  FAILURE_BLOCKER: {
    name: "failure_blocker",
    lockScope: "ORDER",
    steps: [
      { name: "feedback_confirmed",       emits: EventTypes.FEEDBACK_FAILED,              required: true },
      { name: "failure_classification",   emits: EventTypes.FAILURE_CLASSIFICATION_REQUESTED, required: true },
      { name: "failure_classified",       emits: EventTypes.FAILURE_CLASSIFIED,         required: true },
      { name: "dependency_check",       emits: EventTypes.DEPENDENCY_CHECK_REQUESTED, required: false },
      { name: "friction_adaptation",    emits: EventTypes.FRICTION_ADAPTATION_REQUESTED, required: false },
      { name: "academy_correction",     emits: EventTypes.ACADEMY_TASK_REQUESTED,     required: false },
      { name: "load_reduction",         emits: EventTypes.LOAD_REDUCTION_REQUESTED,   required: false },
      { name: "correction_task",        emits: EventTypes.CORRECTION_TASK_REQUESTED,  required: false },
      { name: "task_generation",        emits: EventTypes.TASK_GENERATION_COMPLETED,  required: true },
      { name: "task_guarantee",         emits: EventTypes.ORDER_AVAILABLE,            required: true },
      { name: "dashboard_refresh",      emits: EventTypes.DASHBOARD_REFRESH_REQUESTED, required: true },
    ],
  },
} as const satisfies Record<string, WorkflowDefinition>;

export type WorkflowName = (typeof Workflows)[keyof typeof Workflows]["name"];
