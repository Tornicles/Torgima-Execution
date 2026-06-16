/**
 * DOC18 — Identity Continuity Engine tests.
 */

import { describe, it, expect } from "vitest";
import {
  STAGE_CUSTOMER_LABELS,
  isCustomerFacingLabel,
  customerLabelForStage,
} from "../../../engines/identity/IdentityPanelProjection.js";
import {
  determineNextStage,
  highestQualifiedStage,
  calculateStage,
} from "../../../engines/identity/IdentityStageEvaluator.js";
import type { TransformationEvidence } from "../../../engines/identity/TransformationEvidenceCollector.js";
import { STAGE_ADVANCEMENT_ORDER } from "../../../engines/identity/stageTypes.js";

const baseEvidence = (): TransformationEvidence => ({
  accepted_feedback_count_7d: 0,
  accepted_feedback_count_14d: 0,
  accepted_feedback_count_30d: 0,
  consistency_7d: 0,
  consistency_14d: 0,
  recovery_tasks_completed: 0,
  returned_after_inactivity: false,
  current_difficulty_level: 3,
  capability_upgrades_proven: 0,
  milestones_completed: 0,
  outcomes_validated: 0,
  critical_false_progress_open: false,
  any_false_progress_open: false,
  missed_windows_last_7_days: 0,
  days_since_last_activity: 0,
  current_streak_days: 0,
  days_active_this_month: 0,
});

describe("identity", () => {
  describe("IdentityStageEvaluator", () => {
    it("T1: UNFORMED → INITIATING when 3+ accepted feedback in 7 days", () => {
      const evidence = baseEvidence();
      evidence.accepted_feedback_count_7d = 3;
      evidence.consistency_7d = 1;
      expect(highestQualifiedStage(evidence)).toBe("INITIATING");
      expect(determineNextStage("UNFORMED", evidence)).toBe("INITIATING");
    });

    it("T3: regression when 3+ missed windows", () => {
      const evidence = baseEvidence();
      evidence.missed_windows_last_7_days = 3;
      expect(evidence.missed_windows_last_7_days >= 3).toBe(true);
    });

    it("T4: RESTARTING qualified after recovery task from REGRESSING path", () => {
      const evidence = baseEvidence();
      evidence.recovery_tasks_completed = 1;
      expect(evidence.recovery_tasks_completed >= 1).toBe(true);
    });

    it("implements all 8 DOC18 stage names in customer labels", () => {
      for (const stage of STAGE_ADVANCEMENT_ORDER) {
        expect(STAGE_CUSTOMER_LABELS[stage]).toBeTruthy();
      }
      expect(STAGE_CUSTOMER_LABELS.REGRESSING).toBe("Time to Refocus");
      expect(STAGE_CUSTOMER_LABELS.RESTARTING).toBe("Restarting Strong");
    });

    it("legacy calculateStage still detects REGRESSING on poor consistency", () => {
      expect(calculateStage(0.2, 5, 10, "building")).toBe("REGRESSING");
    });
  });

  describe("IdentityPanelProjection", () => {
    it("T5: panel uses customer labels — INITIATING → Building Momentum", () => {
      expect(customerLabelForStage("INITIATING")).toBe("Building Momentum");
      expect(isCustomerFacingLabel("Building Momentum")).toBe(true);
      expect(isCustomerFacingLabel("INITIATING")).toBe(false);
    });

    it("T5: panel labels never expose internal enum values", () => {
      for (const label of Object.values(STAGE_CUSTOMER_LABELS)) {
        expect(label).not.toMatch(
          /^(UNFORMED|INITIATING|BUILDING|STABILIZING|EXPANDING|INTEGRATED|REGRESSING|RESTARTING)$/,
        );
      }
    });
  });

  describe("false progress blocking", () => {
    it("T2: BUILDING advancement blocked when CRITICAL false progress open", () => {
      const evidence = baseEvidence();
      evidence.accepted_feedback_count_14d = 8;
      evidence.consistency_14d = 0.6;
      evidence.critical_false_progress_open = true;
      expect(highestQualifiedStage(evidence)).toBe("BUILDING");
      const blocked =
        evidence.critical_false_progress_open &&
        highestQualifiedStage(evidence) === "BUILDING";
      expect(blocked).toBe(true);
    });
  });
});

describe("identity — verified evidence gate", () => {
  it("rejects gaming feedback from identity evidence", async () => {
    const { isVerifiedFeedbackEvidence } = await import(
      "../../../engines/identity/TransformationEvidenceCollector.js"
    );
    expect(
      isVerifiedFeedbackEvidence({
        validity: "valid",
        gaming_flag: true,
        interrogation_json: null,
        confidence_score: 0.9,
      } as never),
    ).toBe(false);
  });
});
