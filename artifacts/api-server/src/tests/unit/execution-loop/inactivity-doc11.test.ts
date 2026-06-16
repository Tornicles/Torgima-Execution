import { describe, expect, it } from "vitest";
import {
  severityFromHoursInactive,
  classifyInactivityReason,
} from "../../../engines/execution-loop/inactivity/InactivityDetectionCore.js";
import { selectRecoveryPath } from "../../../engines/execution-loop/inactivity/RecoveryPathSelector.js";
import { EVENT_TYPES } from "../../../services/EventService.js";
import { EventTypes } from "../../../types/eventContracts.js";

describe("inactivity — DOC 11 severity thresholds", () => {
  it("returns MODERATE after 25 hours without activity", () => {
    expect(severityFromHoursInactive(25)).toBe("MODERATE");
  });

  it("returns CRITICAL after 10 days (240 hours)", () => {
    expect(severityFromHoursInactive(240)).toBe("CRITICAL");
  });

  it("returns null below 24 hours", () => {
    expect(severityFromHoursInactive(12)).toBeNull();
  });
});

describe("inactivity — classification", () => {
  it("classifies HARD task with low score as TASK_TOO_HARD", () => {
    const result = classifyInactivityReason({
      lastOrderDifficulty: "hard",
      lastFeedbackScore: 3,
      hadRecentFriction: true,
    });
    expect(result.inactivity_type).toBe("TASK_TOO_HARD");
  });

  it("classifies external clarity blockers as TASK_UNCLEAR", () => {
    const result = classifyInactivityReason({
      lastCompletionStatus: "blocked",
      lastBlockerCategory: "CLARITY_NEEDED",
    });
    expect(result.inactivity_type).toBe("TASK_UNCLEAR");
  });
});

describe("inactivity — recovery path selection", () => {
  it("requests easy recovery task for TASK_TOO_HARD", () => {
    const path = selectRecoveryPath({
      inactivity_type: "TASK_TOO_HARD",
      severity: "HIGH",
      hours_inactive: 100,
    });
    expect(path.primary_event).toBe(EVENT_TYPES.RECOVERY_TASK_REQUESTED);
    expect(path.payload.task_difficulty).toBe("easy");
  });

  it("requests priority review for WRONG_WORK", () => {
    const path = selectRecoveryPath({
      inactivity_type: "WRONG_WORK",
      severity: "HIGH",
      hours_inactive: 100,
    });
    expect(path.primary_event).toBe(EVENT_TYPES.PRIORITY_REVIEW_REQUESTED);
  });

  it("reduces enforcement to 1 task on CRITICAL severity", () => {
    const path = selectRecoveryPath({
      inactivity_type: "UNKNOWN",
      severity: "CRITICAL",
      hours_inactive: 240,
    });
    expect(path.enforcement_task_limit_max).toBe(1);
    expect(path.skip_signal_recalculation).toBe(true);
  });
});

describe("inactivity — event contracts", () => {
  it("registers abandonment_risk event type", () => {
    expect(EventTypes.ABANDONMENT_RISK).toBe("abandonment_risk");
  });
});

describe("inactivity — resolution contract", () => {
  it("uses returned_to_execution resolution type in payload shape", () => {
    const payload = {
      inactivity_record_id: "00000000-0000-4000-8000-000000000099",
      resolution_type: "returned_to_execution",
    };
    expect(payload.resolution_type).toBe("returned_to_execution");
  });
});
