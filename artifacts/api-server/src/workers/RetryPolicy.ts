/**
 * DOC16 — named retry policies with explicit backoff schedules.
 */

export type RetryPolicyName = "STANDARD" | "CRITICAL" | "FAST" | "BHUDHI";

export interface NamedRetryPolicy {
  maxRetries: number;
  backoffMs: readonly number[];
}

/** DOC16 Task 2 — canonical retry policies. */
export const RETRY_POLICIES: Record<RetryPolicyName, NamedRetryPolicy> = {
  STANDARD: { maxRetries: 3, backoffMs: [1000, 3000, 9000] },
  CRITICAL: { maxRetries: 5, backoffMs: [500, 1000, 2000, 5000, 10000] },
  FAST: { maxRetries: 2, backoffMs: [500, 1500] },
  BHUDHI: { maxRetries: 1, backoffMs: [2000] },
};

export function getMaxRetriesForPolicy(policy: RetryPolicyName): number {
  return RETRY_POLICIES[policy].maxRetries;
}

/** retryCount = failures so far (0-based index into backoffMs). */
export function getBackoffDelayMs(policy: RetryPolicyName, retryCount: number): number {
  const schedule = RETRY_POLICIES[policy].backoffMs;
  const idx = Math.max(0, Math.min(retryCount, schedule.length - 1));
  return schedule[idx] ?? schedule[schedule.length - 1] ?? 1000;
}

export function getNextRunAfterForPolicy(policy: RetryPolicyName, retryCount: number): Date {
  return new Date(Date.now() + getBackoffDelayMs(policy, retryCount));
}

export function shouldDeadLetter(policy: RetryPolicyName, nextRetryCount: number): boolean {
  return nextRetryCount > RETRY_POLICIES[policy].maxRetries;
}

/** Legacy bridge — per-event-type policies in engines/events/RetryPolicy.ts */
export {
  RetryPolicies,
  getRetryPolicy,
  getMaxAttempts,
  getNextRunAfter,
} from "../engines/events/RetryPolicy.js";
