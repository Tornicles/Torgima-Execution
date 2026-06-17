/** Partial unique indexes required after schema push (Prompt 1). */
export const REQUIRED_PARTIAL_INDEXES = [
  "one_active_blueprint_per_user",
  "one_current_signal_per_blueprint",
  "one_current_condition_per_blueprint",
  "one_current_enforcement_per_blueprint",
  "one_current_state_memory_per_blueprint",
  "one_current_domain_per_blueprint",
];
