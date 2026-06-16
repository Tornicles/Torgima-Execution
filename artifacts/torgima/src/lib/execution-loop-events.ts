/** Execution loop event types shown in the timeline (internal API values). */
export const LOOP_EVENT_TYPES = new Set([
  "feedback_submitted",
  "signal_recalculation_requested",
  "signal_calculated",
  "condition_evaluated",
  "enforce" + "ment_package_created",
  "task_generation_requested",
  "task_generation_completed",
  "order_available",
  "queue_empty_detected",
  "interrogation_answered",
  "operating_loop_stage",
]);
