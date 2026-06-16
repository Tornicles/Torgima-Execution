/**
 * ERECTOR Prompt 12 — canonical event type strings for the Erector lifecycle.
 * Registered in eventContracts.ts; emit via EventService.writeEvent.
 */
export const ERECTOR_EVENTS = {
  INTAKE_STARTED: "erector_intake_started",
  INTAKE_NORMALIZED: "erector_intake_normalized",
  MISSING_FIELDS_DETECTED: "erector_missing_fields_detected",
  CONTRADICTION_DETECTED: "erector_contradiction_detected",
  ARCHETYPE_CLASSIFIED: "erector_archetype_classified",
  HYBRID_ARCHETYPE_DETECTED: "erector_hybrid_archetype_detected",
  VALIDATION_REQUESTED: "erector_validation_requested",
  VALIDATION_COMPLETED: "erector_validation_completed",
  VERDICT_RULE_APPLIED: "erector_verdict_rule_applied",
  SIMULATION_REQUESTED: "erector_simulation_requested",
  SIMULATION_COMPLETED: "erector_simulation_completed",
  FRAMEWORK_VETO_APPLIED: "erector_framework_veto_applied",
  LAUNCH_PERMISSION_GRANTED: "erector_launch_permission_granted",
  LAUNCH_PERMISSION_BLOCKED: "erector_launch_permission_blocked",
  INTELLIGENCE_INJECTED: "erector_intelligence_injected",
  EVIDENCE_SUBMITTED: "erector_evidence_submitted",
  SIGNAL_CALCULATED: "erector_signal_calculated",
  STATE_CHANGED: "erector_state_changed",
  CORRECTION_PATH_OPENED: "erector_correction_path_opened",
  CORRECTION_PATH_RESOLVED: "erector_correction_path_resolved",
  CAPABILITY_GAP_DETECTED: "erector_capability_gap_detected",
  CAPABILITY_GAP_RESOLVED: "erector_capability_gap_resolved",
  AUDIT_RECORD_CREATED: "erector_audit_record_created",
  RESIMULATION_TRIGGERED: "erector_resimulation_triggered",
  PHASE_GATE_PASSED: "erector_phase_gate_passed",
  PHASE_GATE_FAILED: "erector_phase_gate_failed",
  MODEL_VERSION_UPDATED: "erector_model_version_updated",
} as const;

export type ErectorEventType = (typeof ERECTOR_EVENTS)[keyof typeof ERECTOR_EVENTS];

/** Suggested worker queue routing for new Erector events. */
export const ERECTOR_EVENT_QUEUE_HINTS: Partial<Record<ErectorEventType, string>> = {
  [ERECTOR_EVENTS.VALIDATION_REQUESTED]: "erector_validation_started",
  [ERECTOR_EVENTS.INTAKE_NORMALIZED]: "erector_validation_started",
  [ERECTOR_EVENTS.SIMULATION_REQUESTED]: "erector_simulation_requested",
  [ERECTOR_EVENTS.CAPABILITY_GAP_DETECTED]: "task_generation_requested",
  [ERECTOR_EVENTS.CAPABILITY_GAP_RESOLVED]: "task_generation_requested",
  [ERECTOR_EVENTS.CORRECTION_PATH_RESOLVED]: "task_generation_requested",
  [ERECTOR_EVENTS.STATE_CHANGED]: "projection_refresh_requested",
  [ERECTOR_EVENTS.INTELLIGENCE_INJECTED]: "projection_refresh_requested",
  [ERECTOR_EVENTS.PHASE_GATE_PASSED]: "projection_refresh_requested",
  [ERECTOR_EVENTS.PHASE_GATE_FAILED]: "task_generation_requested",
};

export const ERECTOR_TERMINAL_EVENTS = new Set<ErectorEventType>([
  ERECTOR_EVENTS.ARCHETYPE_CLASSIFIED,
  ERECTOR_EVENTS.HYBRID_ARCHETYPE_DETECTED,
  ERECTOR_EVENTS.VERDICT_RULE_APPLIED,
  ERECTOR_EVENTS.SIMULATION_COMPLETED,
  ERECTOR_EVENTS.FRAMEWORK_VETO_APPLIED,
  ERECTOR_EVENTS.LAUNCH_PERMISSION_GRANTED,
  ERECTOR_EVENTS.LAUNCH_PERMISSION_BLOCKED,
  ERECTOR_EVENTS.AUDIT_RECORD_CREATED,
  ERECTOR_EVENTS.RESIMULATION_TRIGGERED,
  ERECTOR_EVENTS.MISSING_FIELDS_DETECTED,
  ERECTOR_EVENTS.CONTRADICTION_DETECTED,
  ERECTOR_EVENTS.EVIDENCE_SUBMITTED,
  ERECTOR_EVENTS.SIGNAL_CALCULATED,
  ERECTOR_EVENTS.CORRECTION_PATH_OPENED,
]);
