/**
 * Phase 1 DOC 11 — inactivity thresholds (minutes) with commitment scaling.
 */

export type InactivityType =
  | "NO_SESSION"
  | "NO_ORDER_ACTION"
  | "NO_FEEDBACK"
  | "MISSED_DUE_WINDOW"
  | "REPEATED_DELAY"
  | "ABANDONED_LOOP"
  | "SYSTEM_STALE";

export type InactivitySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type CommitmentLevel = "LOW" | "MEDIUM" | "HIGH" | "INTENSE";

/** Default thresholds in minutes (before commitment multiplier). */
export const PHASE1_INACTIVITY_THRESHOLDS_MIN = {
  NO_SESSION: 24 * 60,
  NO_ORDER_ACTION: 12 * 60,
  NO_FEEDBACK: 8 * 60,
  MISSED_DUE_WINDOW_GRACE: 2 * 60,
  REPEATED_DELAY_COUNT: 3,
  REPEATED_DELAY_WINDOW_DAYS: 7,
  ABANDONED_LOOP: 72 * 60,
  SYSTEM_STALE: 60,
} as const;

const COMMITMENT_MULTIPLIER: Record<CommitmentLevel, number> = {
  LOW: 1.75,
  MEDIUM: 1.0,
  HIGH: 0.75,
  INTENSE: 0.5,
};

export function scaleThresholdMinutes(
  baseMinutes: number,
  commitment: CommitmentLevel | null | undefined,
): number {
  const mult = COMMITMENT_MULTIPLIER[commitment ?? "MEDIUM"] ?? 1;
  return baseMinutes * mult;
}

export function parseCommitmentLevel(raw: string | null | undefined): CommitmentLevel {
  const v = String(raw ?? "MEDIUM").toUpperCase();
  if (v === "LOW" || v === "HIGH" || v === "INTENSE") return v;
  return "MEDIUM";
}

const SEVERITY_RANK: Record<InactivitySeverity, number> = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function maxSeverity(
  a: InactivitySeverity,
  b: InactivitySeverity,
): InactivitySeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export function severityForType(type: InactivityType): InactivitySeverity {
  switch (type) {
    case "NO_SESSION":
    case "NO_ORDER_ACTION":
      return "LOW";
    case "NO_FEEDBACK":
    case "MISSED_DUE_WINDOW":
      return "MEDIUM";
    case "REPEATED_DELAY":
    case "SYSTEM_STALE":
      return "HIGH";
    case "ABANDONED_LOOP":
      return "CRITICAL";
    default:
      return "LOW";
  }
}

/** @deprecated GAP G5 hourly classifier — use Phase1 scanAll dimensions instead. */
export const INACTIVITY_DOC11_THRESHOLDS = {
  session_warning: 24,
  order_action_warning: 12,
  feedback_delay_warning: 8,
  missed_execution: 24,
  repeated_delay_window: 72,
  abandoned_loop: 168,
  critical_abandonment: 336,
} as const;

export type ThresholdBreached = "warning" | "soft" | "hard" | "critical";

export function classifyInactivity(hoursInactive: number): {
  type: InactivityType;
  severity: InactivitySeverity;
  thresholdBreached: ThresholdBreached;
} | null {
  const t = INACTIVITY_DOC11_THRESHOLDS;
  const hours = hoursInactive;

  if (hours >= t.critical_abandonment) {
    return { type: "ABANDONED_LOOP", severity: "CRITICAL", thresholdBreached: "critical" };
  }
  if (hours >= t.abandoned_loop) {
    return { type: "ABANDONED_LOOP", severity: "HIGH", thresholdBreached: "hard" };
  }
  if (hours >= t.missed_execution) {
    return { type: "MISSED_DUE_WINDOW", severity: "MEDIUM", thresholdBreached: "soft" };
  }
  if (hours >= t.feedback_delay_warning) {
    return { type: "NO_FEEDBACK", severity: "LOW", thresholdBreached: "warning" };
  }
  return null;
}

export function requiresRecoveryEvent(thresholdBreached: ThresholdBreached): boolean {
  return thresholdBreached === "soft" || thresholdBreached === "hard" || thresholdBreached === "critical";
}
