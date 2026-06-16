import { EVENT_TYPES } from "../../../services/EventService.js";
import type { EventType } from "../../../types/eventContracts.js";
import type { Doc11InactivityType } from "./InactivityClassifier.js";

export type Doc11InactivitySeverity = "SHORT" | "MODERATE" | "HIGH" | "CRITICAL";

export type RecoveryPathDecision = {
  primary_event: EventType;
  secondary_events: EventType[];
  payload: Record<string, unknown>;
  enforcement_task_limit_max?: number;
  skip_signal_recalculation?: boolean;
};

export function selectRecoveryPath(params: {
  inactivity_type: Doc11InactivityType;
  severity: Doc11InactivitySeverity;
  hours_inactive: number;
}): RecoveryPathDecision {
  const basePayload = {
    reason: "inactivity",
    inactivity_type: params.inactivity_type,
    severity: params.severity,
    hours_inactive: params.hours_inactive,
  };

  if (params.severity === "SHORT") {
    return {
      primary_event: EVENT_TYPES.INACTIVITY_DETECTED,
      secondary_events: [],
      payload: { ...basePayload, action: "watch_only" },
    };
  }

  if (params.inactivity_type === "TASK_UNCLEAR") {
    return {
      primary_event: EVENT_TYPES.CLARIFICATION_TASK_REQUESTED,
      secondary_events: [EVENT_TYPES.INACTIVITY_DETECTED],
      payload: {
        ...basePayload,
        task_type: "clarification",
        content: "Re-explain the blocked task in simpler terms.",
      },
    };
  }

  if (params.inactivity_type === "WRONG_WORK") {
    return {
      primary_event: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
      secondary_events: [EVENT_TYPES.INACTIVITY_DETECTED],
      payload: {
        ...basePayload,
        task_type: "priority_review",
        title: "Review what work is actually needed before resuming execution.",
      },
    };
  }

  const recoveryPayload = {
    ...basePayload,
    task_type: "recovery",
    task_difficulty: "easy",
    title:
      params.inactivity_type === "LIFE_EVENT"
        ? "Welcome back. Here is where you left off."
        : params.inactivity_type === "LOSING_MOMENTUM"
          ? "Return to your project — a simple step to restart momentum."
          : "Return to your project — a simple step to restart",
    tone: params.inactivity_type === "LIFE_EVENT" ? "calm" : "supportive",
  };

  const secondary: EventType[] = [EVENT_TYPES.INACTIVITY_DETECTED, EVENT_TYPES.RECOVERY_TASK_REQUESTED];
  if (params.inactivity_type === "LOSING_MOMENTUM") {
    secondary.push(EVENT_TYPES.IDENTITY_EVALUATION_REQUESTED);
  }

  const decision: RecoveryPathDecision = {
    primary_event: EVENT_TYPES.RECOVERY_TASK_REQUESTED,
    secondary_events: secondary,
    payload: recoveryPayload,
  };

  if (params.severity === "CRITICAL") {
    decision.enforcement_task_limit_max = 1;
    decision.skip_signal_recalculation = true;
    decision.payload = {
      ...decision.payload,
      restart_encouragement_only: true,
      condition_floor: "urgency",
    };
  }

  return decision;
}
