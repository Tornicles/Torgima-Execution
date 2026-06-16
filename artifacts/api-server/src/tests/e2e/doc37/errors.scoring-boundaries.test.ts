/**

 * DOC 37 §4 — scoring boundary tests.

 */

import { describe, it, expect } from "vitest";

import { detectGaming } from "../../../engines/execution-loop/feedback/GamingDetector.js";

import { determineFeedbackVerdict } from "../../../engines/execution-loop/feedback/FeedbackVerdictEngine.js";

import { buildInterrogationDecision } from "../../../engines/execution-loop/feedback/InterrogationEngine.js";

import { assignConditionFromMetricMatrix } from "../../../engines/signal/ConditionMetricMatrix.js";

import { resolveConflicts } from "../../../engines/erector/RuleConflictResolver.js";

import { thresholdRowToTierThresholds } from "../../../engines/erector/ValidationScoringEngine.js";

import { riskLevelFromScore } from "../../../engines/pattern/BurnoutRiskScorer.js";

import { highestQualifiedStage } from "../../../engines/identity/IdentityStageEvaluator.js";

import type { TransformationEvidence } from "../../../engines/identity/TransformationEvidenceCollector.js";

import type { FeedbackSubmissionPayload } from "../../../engines/feedback/submitFeedbackPhase1.js";

import type { SignalMetrics } from "../../../engines/signal/SignalCalculationEngine.types.js";



const baseOrder = {

  proof_required: false,

  time_estimate_minutes: 60,

  difficulty: "moderate",

  title: "Publish landing page",

  started_at: new Date(Date.now() - 2 * 3_600_000),
} as never;



const basePayload = (overrides: Partial<FeedbackSubmissionPayload> = {}): FeedbackSubmissionPayload => ({

  orderId: "00000000-0000-4000-8000-000000000001",

  completion: "COMPLETED",

  clientStateVersion: 1,

  idempotencyKey: "doc37-boundary",

  effortScore: 1,

  frictionScore: 3,

  durationMinutes: 30,

  userNotes: "Marked complete but outcome was minimal; documenting honest low effort result.",

  ...overrides,

});



function identityEvidence(overrides: Partial<TransformationEvidence> = {}): TransformationEvidence {

  return {

    accepted_feedback_count_7d: 7,

    accepted_feedback_count_14d: 8,

    accepted_feedback_count_30d: 10,

    consistency_7d: 0.5,

    consistency_14d: 0.5,

    recovery_tasks_completed: 0,

    returned_after_inactivity: false,

    capability_upgrades_proven: 0,

    current_difficulty_level: 2,

    outcomes_validated: 0,

    milestones_completed: 0,

    critical_false_progress_open: false,

    any_false_progress_open: false,

    missed_windows_last_7_days: 0,

    days_since_last_activity: 2,

    current_streak_days: 5,

    days_active_this_month: 8,

    ...overrides,

  };

}



const emptySignalMetrics = (): SignalMetrics => ({

  completion_rate: 0,

  weighted_score: 0,

  raw_score: 0,

  momentum: 0,

  trend: "stable",

  confidence: "insufficient_data",

  blocker_ratio: 0,

  skip_ratio: 0,

  tasks_in_window: 0,

  avg_difficulty_felt: null,

});



describe("DOC 37 — errors.scoring-boundaries", () => {

  it("BOUNDARY 1: score=0 with completed → PARTIAL_ACCEPTED via reduced confidence", () => {

    const payload = { ...basePayload(), effortScore: 0 } as unknown as FeedbackSubmissionPayload;

    const gaming = detectGaming({

      payload,

      order: baseOrder,

      recentFeedbacks: [],

      reflection: payload.userNotes ?? "",

    });

    const interrogation = { required: false, validation_status: "accepted" as const };

    const verdict = determineFeedbackVerdict({

      payload,

      order: baseOrder,

      proofPresent: false,

      proofValidation: { valid: true, proof_class: "NONE" },

      gaming,

      confidence_multiplier: 0.55,

      interrogation,

    });

    expect(verdict).toBe("PARTIAL_ACCEPTED");

  });



  it("BOUNDARY 2: score=10 with reflection=Done → interrogation flag", () => {

    const gaming = detectGaming({

      payload: basePayload({ effortScore: 5, userNotes: "Done" }),

      order: baseOrder,

      recentFeedbacks: [],

      reflection: "Done",

    });

    expect(gaming.flags).toContain("HIGH_SCORE_WEAK_REFLECTION");

    expect(gaming.trigger_interrogation || gaming.gaming_suspected).toBe(true);

  });



  it("BOUNDARY 3: zero accepted feedback → insufficient_data and nothingness", () => {

    const condition = assignConditionFromMetricMatrix(emptySignalMetrics(), "nothingness");

    expect(condition).toBe("nothingness");

  });



  it("BOUNDARY 4: Starter overall_score=60 exactly → PROCEED", () => {

    const thresholds = thresholdRowToTierThresholds({

      tier: "starter",

      proceed_min_score: 60,

      adjust_min_score: 40,

      pivot_max_score: 39,

      market_weight: 0.25,

      demand_weight: 0.25,

      feasibility_weight: 0.25,

      context_weight: 0.25,

      demand_proof_min_class: 2,

    });

    const resolved = resolveConflicts(

      {

        rules_evaluated: 0,

        rules_fired: [],

        hard_blockers: [],

        soft_blockers: [],

        soft_warnings: [],

        verdict_effects: [],

        decisions_to_write: [],

        framework_hard_veto: false,

      },

      {

        market_viability_score: 60,

        demand_proof_score: 60,

        feasibility_score: 60,

        context_readiness_score: 60,

        contradiction_score: 0,

        evidence_quality_score: 60,

        overall_validation_score: 60,

        demand_proof_class: 2,

        feasibility_rating: "moderate",

      },

      thresholds,

    );

    expect(resolved.verdict).toBe("PROCEED");

  });



  it("BOUNDARY 5: burnout risk score exactly 75 → CRITICAL", () => {

    expect(riskLevelFromScore(75)).toBe("CRITICAL");

  });



  it("BOUNDARY 6: identity consistency exactly 50% meets BUILDING (inclusive)", () => {

    const evidence = identityEvidence({

      accepted_feedback_count_14d: 8,

      consistency_14d: 0.5,

    });

    expect(highestQualifiedStage(evidence)).toBe("BUILDING");

  });

});


