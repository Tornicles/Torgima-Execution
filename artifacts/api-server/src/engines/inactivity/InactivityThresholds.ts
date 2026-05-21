/**
 * GAP G5 / DOC_11 — inactivity detection thresholds (hours).
 */

export const INACTIVITY_DOC11_THRESHOLDS = {
  session_warning: 24,
  order_action_warning: 12,
  feedback_delay_warning: 2,
  missed_execution: 24,
  repeated_delay_window: 72,
  abandoned_loop: 168,
  critical_abandonment: 336,
} as const;

export type InactivityType =
  | "NO_SESSION"
  | "NO_ORDER_ACTION"
  | "NO_FEEDBACK"
  | "MISSED_DUE_WINDOW"
  | "REPEATED_DELAY"
  | "ABANDONED_LOOP"
  | "SYSTEM_STALE";

export type InactivitySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ThresholdBreached = "warning" | "soft" | "hard" | "critical";

export function classifyInactivity(hoursInactive: number): {
  type: InactivityType;
  severity: InactivitySeverity;
  thresholdBreached: ThresholdBreached;
} | null {
  const t = INACTIVITY_DOC11_THRESHOLDS;

  if (hoursInactive >= t.critical_abandonment) {
    return { type: "ABANDONED_LOOP", severity: "CRITICAL", thresholdBreached: "critical" };
  }
  if (hoursInactive >= t.abandoned_loop) {
    return { type: "ABANDONED_LOOP", severity: "HIGH", thresholdBreached: "hard" };
  }
  if (hoursInactive >= t.missed_execution) {
    return { type: "MISSED_DUE_WINDOW", severity: "MEDIUM", thresholdBreached: "soft" };
  }
  if (hoursInactive >= t.feedback_delay_warning) {
    return { type: "NO_FEEDBACK", severity: "LOW", thresholdBreached: "warning" };
  }

  return null;
}

/** Recovery event required at soft+ (24h without meaningful feedback). */
export function requiresRecoveryEvent(thresholdBreached: ThresholdBreached): boolean {
  return thresholdBreached === "soft" || thresholdBreached === "hard" || thresholdBreached === "critical";
}
