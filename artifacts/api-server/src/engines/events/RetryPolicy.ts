/**
 * GAP G2 — per-event-type retry policies (DOC_16).
 */

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export const RetryPolicies: Record<string, RetryPolicy> = {
  feedback_submitted:             { maxAttempts: 5, backoffMs: 1000,  backoffMultiplier: 2 },
  signal_recalculation_requested:   { maxAttempts: 5, backoffMs: 1000,  backoffMultiplier: 2 },
  signal_calculated:                { maxAttempts: 5, backoffMs: 1000,  backoffMultiplier: 2 },
  condition_evaluated:              { maxAttempts: 5, backoffMs: 2000,  backoffMultiplier: 2 },
  enforcement_package_created:      { maxAttempts: 5, backoffMs: 2000,  backoffMultiplier: 2 },
  task_generation_requested:        { maxAttempts: 5, backoffMs: 2000,  backoffMultiplier: 2 },
  task_generation_completed:        { maxAttempts: 5, backoffMs: 2000,  backoffMultiplier: 2 },
  blueprint_launched:               { maxAttempts: 5, backoffMs: 1000,  backoffMultiplier: 2 },
  inactivity_detected:              { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  reward_evaluation_requested:      { maxAttempts: 3, backoffMs: 10000, backoffMultiplier: 2 },
  identity_evaluation_requested:    { maxAttempts: 3, backoffMs: 10000, backoffMultiplier: 2 },
  outcome_validation_requested:     { maxAttempts: 3, backoffMs: 10000, backoffMultiplier: 2 },
  pattern_scan_requested:             { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  erector_validation_started:         { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  archetype_resolved:                 { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  erector_engine_completed:           { maxAttempts: 5, backoffMs: 3000,  backoffMultiplier: 2 },
  erector_validation_completed:         { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  erector_path_selected:              { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  erector_first_week_generated:       { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  erector_blueprint_launched:         { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
  default:                          { maxAttempts: 3, backoffMs: 5000,  backoffMultiplier: 2 },
};

const MAX_BACKOFF_MS = 300_000;

export function getRetryPolicy(eventType: string): RetryPolicy {
  return RetryPolicies[eventType] ?? RetryPolicies.default;
}

export function getMaxAttempts(eventType: string): number {
  return getRetryPolicy(eventType).maxAttempts;
}

/** Exponential backoff capped at 5 minutes (attemptCount = failures so far). */
export function getNextRunAfter(eventType: string, attemptCount: number): Date {
  const policy = getRetryPolicy(eventType);
  const delayMs = policy.backoffMs * Math.pow(policy.backoffMultiplier, attemptCount);
  return new Date(Date.now() + Math.min(delayMs, MAX_BACKOFF_MS));
}
