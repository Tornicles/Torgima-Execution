/**
 * GAP G1 — single source of truth for event type names and queue routing (DOC_28).
 * Import EventTypes / WorkerQueues / EVENT_QUEUE_MAP — never hardcode event strings.
 */

export const EventTypes = {
  // Core feedback loop
  FEEDBACK_SUBMITTED:               "feedback_submitted",
  FEEDBACK_REJECTED:                "feedback_rejected",
  INTERROGATION_ANSWERED:           "interrogation_answered",
  SIGNAL_RECALCULATION_REQUESTED:   "signal_recalculation_requested",
  SIGNAL_CALCULATED:                "signal_calculated",
  CONDITION_EVALUATED:              "condition_evaluated",
  ENFORCEMENT_PACKAGE_CREATED:      "enforcement_package_created",
  TASK_GENERATION_REQUESTED:        "task_generation_requested",
  TASK_GENERATION_COMPLETED:        "task_generation_completed",
  TASK_GENERATION_FAILED:           "task_generation_failed",
  ORDER_AVAILABLE:                  "order_available",
  QUEUE_EMPTY_DETECTED:             "queue_empty_detected",
  DASHBOARD_REFRESH_REQUESTED:      "dashboard_refresh_requested",
  PROJECTION_REFRESH_REQUESTED:     "projection_refresh_requested",
  // Inactivity
  INACTIVITY_SCAN_REQUESTED:        "inactivity_scan_requested",
  INACTIVITY_DETECTED:              "inactivity_detected",
  INACTIVITY_RESOLVED:              "inactivity_resolved",
  // Blueprint lifecycle
  BLUEPRINT_LAUNCHED:               "blueprint_launched",
  BLUEPRINT_PAUSED:                 "blueprint_paused",
  BLUEPRINT_RESUMED:                "blueprint_resumed",
  BLUEPRINT_COMPLETED:              "blueprint_completed",
  BLUEPRINT_ADJUSTED:               "blueprint_adjusted",
  BLUEPRINT_PIVOTED:                "blueprint_pivoted",
  PIVOT_REVIEW_REQUESTED:           "pivot_review_requested",
  PIVOT_REVIEW_READY:               "pivot_review_ready",
  PIVOT_REVIEW_DISMISSED:           "pivot_review_dismissed",
  PIVOT_PATH_SELECTED:              "pivot_path_selected",
  // Notifications / state
  REMINDER_REQUESTED:               "reminder_requested",
  NOTIFICATION_SEND_REQUESTED:      "notification_send_requested",
  STATE_CHANGED:                    "state_changed",
  OPERATING_LOOP_STAGE:             "operating_loop_stage",
  // AI / health / intelligence
  BHUDHI_TRIGGER_REQUESTED:         "bhudhi_trigger_requested",
  BHUDHI_CALL_COMPLETED:            "bhudhi_call_completed",
  BHUDHI_FALLBACK_USED:             "bhudhi_fallback_used",
  SYSTEM_HEALTH_DEGRADED:           "system_health_degraded",
  SYSTEM_HEALTH_RESTORED:           "system_health_restored",
  BURNOUT_RISK_DETECTED:            "burnout_risk_detected",
  COGNITIVE_LOAD_HIGH:              "cognitive_load_high",
  FRICTION_ADAPTATION_REQUESTED:    "friction_adaptation_requested",
  EXTERNAL_SIGNAL_RECEIVED:         "external_signal_received",
  FALSE_PROGRESS_DETECTED:          "false_progress_detected",
  OUTCOME_VALIDATION_REQUESTED:     "outcome_validation_requested",
  IDENTITY_EVALUATION_REQUESTED:    "identity_evaluation_requested",
  REWARD_EVALUATION_REQUESTED:      "reward_evaluation_requested",
  FAILURE_CLASSIFIED:               "failure_classified",
  PATTERN_SCAN_REQUESTED:           "pattern_scan_requested",
  VALIDATION_START_REQUESTED:       "validation_start_requested",
  VALIDATION_COMPLETED:             "validation_completed",
  VALIDATION_PATH_SELECTED:         "validation_path_selected",
  ERECTOR_VALIDATION_STARTED:         "erector_validation_started",
  /** @deprecated Use ERECTOR_VALIDATION_COMPLETED — same lifecycle, spec name. */
  ERECTOR_VALIDATION_COMPLETE:        "erector_validation_completed",
  ERECTOR_VALIDATION_COMPLETED:       "erector_validation_completed",
  ARCHETYPE_RESOLVED:                 "archetype_resolved",
  ERECTOR_ENGINE_COMPLETED:           "erector_engine_completed",
  ERECTOR_PATH_SELECTED:              "erector_path_selected",
  ERECTOR_FIRST_WEEK_GENERATED:       "erector_first_week_generated",
  ERECTOR_BLUEPRINT_LAUNCHED:           "erector_blueprint_launched",
  BLUEPRINT_LAUNCH_FAILED:            "blueprint_launch_failed",
  ARCHETYPE_CONTEXT_MISSING:        "archetype_context_missing",
  ASSUMPTION_CHECK_REQUESTED:       "assumption_check_requested",
  EIS_REFRESH_REQUESTED:            "eis_refresh_requested",
  SYSTEM_HEALTH_SCAN_REQUESTED:     "system_health_scan_requested",
  DEAD_LETTER_REVIEW_REQUESTED:     "dead_letter_review_requested",
  OVERNIGHT_COMPLETE:               "overnight_complete",
  HEALTH_ALERT:                     "health_alert",
  DLQ_ITEM_CREATED:                 "dlq_item_created",
  ORCHESTRATION_LOCK:               "ORCHESTRATION_LOCK",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/** pg-boss queue names — workers subscribe to these. */
export const WorkerQueues = {
  FEEDBACK_PROCESSING:        "feedback_processing_requested",
  SIGNAL_RECALCULATION:       "signal_recalculation_requested",
  CONDITION_EVALUATION:       "condition_evaluation_requested",
  ENFORCEMENT_PACKAGE:        "enforcement_package_requested",
  TASK_GENERATION:            "task_generation_requested",
  TASK_GUARANTEE:             "task_guarantee_check",
  PROJECTION_REFRESH:         "projection_refresh_requested",
  INACTIVITY_SCAN:            "inactivity_scan_requested",
  REWARD_EVALUATION:          "reward_evaluation_requested",
  IDENTITY_EVALUATION:        "identity_evaluation_requested",
  BHUDHI_TRIGGER:             "bhudhi_trigger_requested",
  SYSTEM_HEALTH:              "system_health_event",
  REMINDER:                   "reminder_requested",
  NOTIFICATION_SEND:          "notification_send_requested",
  VALIDATION_START:           "validation_start_requested",
  PATTERN_SCAN:               "pattern_scan_requested",
  ASSUMPTION_CHECK:           "assumption_check_requested",
  DEAD_LETTER_REVIEW:         "dead_letter_review_requested",
  OUTCOME_VALIDATION:         "outcome_validation_requested",
  /** Prompt 8 — Erector event workers (queue name matches event type). */
  ERECTOR_VALIDATION_STARTED:   "erector_validation_started",
  ARCHETYPE_RESOLVED:           "archetype_resolved",
  ERECTOR_ENGINE_COMPLETED:     "erector_engine_completed",
  ERECTOR_VALIDATION_COMPLETED: "erector_validation_completed",
  ERECTOR_PATH_SELECTED:        "erector_path_selected",
  ERECTOR_FIRST_WEEK_GENERATED: "erector_first_week_generated",
  ERECTOR_BLUEPRINT_LAUNCHED:   "erector_blueprint_launched",
} as const;

export type WorkerQueue = (typeof WorkerQueues)[keyof typeof WorkerQueues];

/** Outbox event_type → pg-boss queue (EventDispatcher). */
export const EVENT_QUEUE_MAP: Record<string, WorkerQueue> = {
  [EventTypes.FEEDBACK_SUBMITTED]:             WorkerQueues.FEEDBACK_PROCESSING,
  [EventTypes.INTERROGATION_ANSWERED]:         WorkerQueues.SIGNAL_RECALCULATION,
  [EventTypes.SIGNAL_RECALCULATION_REQUESTED]: WorkerQueues.SIGNAL_RECALCULATION,
  [EventTypes.SIGNAL_CALCULATED]:              WorkerQueues.CONDITION_EVALUATION,
  [EventTypes.CONDITION_EVALUATED]:            WorkerQueues.ENFORCEMENT_PACKAGE,
  [EventTypes.ENFORCEMENT_PACKAGE_CREATED]:    WorkerQueues.TASK_GENERATION,
  [EventTypes.TASK_GENERATION_REQUESTED]:        WorkerQueues.TASK_GENERATION,
  [EventTypes.TASK_GENERATION_COMPLETED]:      WorkerQueues.TASK_GUARANTEE,
  [EventTypes.QUEUE_EMPTY_DETECTED]:           WorkerQueues.TASK_GENERATION,
  [EventTypes.DASHBOARD_REFRESH_REQUESTED]:    WorkerQueues.PROJECTION_REFRESH,
  [EventTypes.INACTIVITY_SCAN_REQUESTED]:      WorkerQueues.INACTIVITY_SCAN,
  [EventTypes.INACTIVITY_DETECTED]:            WorkerQueues.TASK_GENERATION,
  [EventTypes.REMINDER_REQUESTED]:             WorkerQueues.REMINDER,
  [EventTypes.NOTIFICATION_SEND_REQUESTED]:    WorkerQueues.NOTIFICATION_SEND,
  [EventTypes.STATE_CHANGED]:                  WorkerQueues.PROJECTION_REFRESH,
  [EventTypes.PROJECTION_REFRESH_REQUESTED]:   WorkerQueues.PROJECTION_REFRESH,
  [EventTypes.BHUDHI_TRIGGER_REQUESTED]:       WorkerQueues.BHUDHI_TRIGGER,
  [EventTypes.SYSTEM_HEALTH_DEGRADED]:         WorkerQueues.SYSTEM_HEALTH,
  [EventTypes.BLUEPRINT_LAUNCHED]:             WorkerQueues.TASK_GENERATION,
  [EventTypes.PIVOT_REVIEW_REQUESTED]:         WorkerQueues.TASK_GENERATION,
  [EventTypes.REWARD_EVALUATION_REQUESTED]:     WorkerQueues.REWARD_EVALUATION,
  [EventTypes.IDENTITY_EVALUATION_REQUESTED]:  WorkerQueues.IDENTITY_EVALUATION,
  [EventTypes.VALIDATION_START_REQUESTED]:     WorkerQueues.VALIDATION_START,
  [EventTypes.PATTERN_SCAN_REQUESTED]:         WorkerQueues.PATTERN_SCAN,
  [EventTypes.ASSUMPTION_CHECK_REQUESTED]:     WorkerQueues.ASSUMPTION_CHECK,
  [EventTypes.SYSTEM_HEALTH_SCAN_REQUESTED]:   WorkerQueues.SYSTEM_HEALTH,
  [EventTypes.DEAD_LETTER_REVIEW_REQUESTED]:   WorkerQueues.DEAD_LETTER_REVIEW,
  [EventTypes.OUTCOME_VALIDATION_REQUESTED]:   WorkerQueues.OUTCOME_VALIDATION,
  [EventTypes.ERECTOR_VALIDATION_STARTED]:     WorkerQueues.ERECTOR_VALIDATION_STARTED,
  [EventTypes.ARCHETYPE_RESOLVED]:             WorkerQueues.ARCHETYPE_RESOLVED,
  [EventTypes.ERECTOR_ENGINE_COMPLETED]:       WorkerQueues.ERECTOR_ENGINE_COMPLETED,
  [EventTypes.ERECTOR_VALIDATION_COMPLETED]:   WorkerQueues.ERECTOR_VALIDATION_COMPLETED,
  [EventTypes.ERECTOR_PATH_SELECTED]:          WorkerQueues.ERECTOR_PATH_SELECTED,
  [EventTypes.ERECTOR_FIRST_WEEK_GENERATED]:   WorkerQueues.ERECTOR_FIRST_WEEK_GENERATED,
  [EventTypes.ERECTOR_BLUEPRINT_LAUNCHED]:     WorkerQueues.ERECTOR_BLUEPRINT_LAUNCHED,
};

/** Persisted for audit; no queue consumer. */
export const TERMINAL_EVENT_TYPES = new Set<string>([
  EventTypes.ORDER_AVAILABLE,
  EventTypes.SYSTEM_HEALTH_RESTORED,
  EventTypes.BURNOUT_RISK_DETECTED,
  EventTypes.COGNITIVE_LOAD_HIGH,
  EventTypes.FRICTION_ADAPTATION_REQUESTED,
  EventTypes.EXTERNAL_SIGNAL_RECEIVED,
  EventTypes.ORCHESTRATION_LOCK,
  EventTypes.FALSE_PROGRESS_DETECTED,
  EventTypes.FAILURE_CLASSIFIED,
  EventTypes.OPERATING_LOOP_STAGE,
  EventTypes.OVERNIGHT_COMPLETE,
  EventTypes.HEALTH_ALERT,
  EventTypes.DLQ_ITEM_CREATED,
  EventTypes.BLUEPRINT_LAUNCH_FAILED,
  EventTypes.ARCHETYPE_CONTEXT_MISSING,
]);

/** DOC_28 / GAP G1 — emitter → consumer contract (live names). */
export const EVENT_CHAIN_CONTRACT: ReadonlyArray<{
  source: string;
  eventEmitted: EventType;
  workerQueue?: WorkerQueue;
  terminal?: boolean;
}> = [
  { source: "FeedbackProcessingEngine", eventEmitted: EventTypes.FEEDBACK_SUBMITTED, workerQueue: WorkerQueues.FEEDBACK_PROCESSING },
  { source: "FeedbackWorker", eventEmitted: EventTypes.SIGNAL_RECALCULATION_REQUESTED, workerQueue: WorkerQueues.SIGNAL_RECALCULATION },
  { source: "SignalWorker", eventEmitted: EventTypes.SIGNAL_CALCULATED, workerQueue: WorkerQueues.CONDITION_EVALUATION },
  { source: "ConditionWorker", eventEmitted: EventTypes.CONDITION_EVALUATED, workerQueue: WorkerQueues.ENFORCEMENT_PACKAGE },
  { source: "ControlWorker", eventEmitted: EventTypes.ENFORCEMENT_PACKAGE_CREATED, workerQueue: WorkerQueues.TASK_GENERATION },
  { source: "TaskGenerationWorker", eventEmitted: EventTypes.TASK_GENERATION_COMPLETED, workerQueue: WorkerQueues.TASK_GUARANTEE },
  { source: "TaskGuaranteeWorker", eventEmitted: EventTypes.ORDER_AVAILABLE, terminal: true },
  { source: "InactivityDetectionEngine", eventEmitted: EventTypes.INACTIVITY_DETECTED, workerQueue: WorkerQueues.TASK_GENERATION },
  { source: "BlueprintEngine", eventEmitted: EventTypes.BLUEPRINT_LAUNCHED, workerQueue: WorkerQueues.TASK_GENERATION },
];

export function resolveQueueForEventType(eventType: string): WorkerQueue | undefined {
  return EVENT_QUEUE_MAP[eventType];
}

export function assertEventQueueContract(): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  for (const row of EVENT_CHAIN_CONTRACT) {
    if (row.terminal) {
      if (!TERMINAL_EVENT_TYPES.has(row.eventEmitted)) {
        mismatches.push(`${row.source}: ${row.eventEmitted} must be in TERMINAL_EVENT_TYPES`);
      }
      continue;
    }
    const mapped = EVENT_QUEUE_MAP[row.eventEmitted];
    if (mapped !== row.workerQueue) {
      mismatches.push(
        `${row.source}: ${row.eventEmitted} maps to ${mapped ?? "(none)"}, expected ${row.workerQueue}`,
      );
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
