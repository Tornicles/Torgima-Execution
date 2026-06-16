/**
 * DOC20 — Outcome validation and false progress tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OutcomeEvidenceScorer,
  determineValidationStatus,
} from "../../../engines/outcome/OutcomeEvidenceScorer.js";
import { FalseProgressDetector } from "../../../engines/outcome/FalseProgressDetector.js";
import {
  CORRECTION_TASK_MAP,
  CorrectionPathGenerator,
} from "../../../engines/outcome/CorrectionPathGenerator.js";
import {
  OutcomeBlockingEnforcer,
  enforceTargetCompletion,
  enforcePhaseAdvancement,
  enforceOutcomeReward,
  enforceDashboardSuccessCopy,
} from "../../../engines/outcome/OutcomeBlockingEnforcer.js";
import { VALIDATION_STATUSES } from "../../../engines/outcome/outcomeTypes.js";

const mockState = vi.hoisted(() => ({
  writeEventCalls: [] as Array<Record<string, unknown>>,
  openFlags: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    CORRECTION_TASK_REQUESTED: "correction_task_requested",
    EVIDENCE_SUBMISSION_TASK_REQUESTED: "evidence_submission_task_requested",
    PRIORITY_REVIEW_REQUESTED: "priority_review_requested",
    ADVANCEMENT_BLOCKED: "advancement_blocked",
    REWARD_EVALUATION_BLOCKED: "reward_evaluation_blocked",
    IDENTITY_ADVANCEMENT_BLOCKED: "identity_advancement_blocked",
  },
  writeEvent: vi.fn(async (input: Record<string, unknown>) => {
    mockState.writeEventCalls.push(input);
    return "evt-doc20";
  }),
}));

vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(mockState.openFlags).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(mockState.openFlags);

  return {
    db: { select: vi.fn(() => chain) },
    falseProgressFlags: {},
    erectorPhaseGates: {},
    erectorEvidenceLedger: {},
    erectorCapabilityProfiles: {},
    outcomeValidations: {},
    blueprints: {},
  };
});

describe("outcome-validation", () => {
  beforeEach(() => {
    mockState.writeEventCalls = [];
    mockState.openFlags = [];
  });

  it("TEST 1: VALIDATED on strong PAYMENT_PROOF evidence and high movement", async () => {
    const execution = {
      completedCount14d: 4,
      completedCount7d: 3,
      totalTasks14d: 4,
      alignedTasks14d: 4,
      hasClaim: true,
      hasPaymentOrExternalProof: true,
    };

    const scoring = OutcomeEvidenceScorer.score(
      [
        {
          evidence_strength: "VERIFIED",
          evidence_class: "PAYMENT_PROOF",
          contradiction_status: null,
          validation_status: "validated",
          integrity_flags: [],
        },
      ],
      execution,
    );

    scoring.outcomeMovementScore = 80;
    scoring.evidenceScore = Math.max(scoring.evidenceScore, 75);
    scoring.contradictionScore = 5;

    const fp = FalseProgressDetector.detect({ scoring, execution });
    const status = determineValidationStatus(scoring, fp, execution);

    expect(status).toBe("VALIDATED");
    const targetBlock = await enforceTargetCompletion({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: status,
    });
    expect(targetBlock.blocked).toBe(false);
    const rewardBlock = await enforceOutcomeReward({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: status,
    });
    expect(rewardBlock.blocked).toBe(false);
  });

  it("TEST 2: FALSE_PROGRESS when 12 tasks completed with no movement", () => {
    const execution = {
      completedCount14d: 12,
      completedCount7d: 12,
      totalTasks14d: 12,
      alignedTasks14d: 2,
      hasClaim: true,
      hasPaymentOrExternalProof: false,
    };

    const scoring = OutcomeEvidenceScorer.score([], execution);
    scoring.outcomeMovementScore = 8;
    scoring.evidenceScore = 15;
    scoring.alignmentScore = 16;

    const fp = FalseProgressDetector.detect({ scoring, execution });
    expect(fp.detected).toBe(true);
    expect(fp.pattern).toBe("ACTIVITY_WITHOUT_OUTCOME");

    const status = determineValidationStatus(scoring, fp, execution);
    expect(status).toBe("FALSE_PROGRESS");
    expect(CORRECTION_TASK_MAP.FALSE_PROGRESS.task_type).toBe("recovery");
  });

  it("TEST 3: CONTRADICTED blocks reward and dashboard celebration", async () => {
    const execution = {
      completedCount14d: 3,
      completedCount7d: 2,
      totalTasks14d: 3,
      alignedTasks14d: 3,
      hasClaim: true,
      hasPaymentOrExternalProof: false,
    };

    const scoring = OutcomeEvidenceScorer.score(
      [{ contradiction_status: "confirmed", evidence_strength: "HIGH" }],
      execution,
    );
    scoring.contradictionScore = 65;

    const fp = FalseProgressDetector.detect({
      scoring,
      execution,
      ledgerContradicted: true,
    });
    const status = determineValidationStatus(scoring, fp, execution);

    expect(status).toBe("CONTRADICTED");
    expect(fp.pattern).toBe("CLAIM_CONTRADICTED");
    const targetBlock = await enforceTargetCompletion({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: status,
    });
    expect(targetBlock.blocked).toBe(true);
    expect(enforceDashboardSuccessCopy(status).blocked).toBe(true);

    const rewardBlock = await enforceOutcomeReward({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: status,
    });
    expect(rewardBlock.blocked).toBe(true);
  });

  it("TEST 4: phase advancement blocked when severe false progress flag is open", async () => {
    mockState.openFlags = [
      {
        id: "flag-1",
        detection_type: "ACTIVITY_WITHOUT_OUTCOME",
        severity: "high",
        false_progress_score: 80,
      },
    ];

    const result = await enforcePhaseAdvancement({
      blueprintId: "bp-1",
      userId: "user-1",
    });

    expect(result.blocked).toBe(true);
    expect(mockState.writeEventCalls.some((e) => e.eventType === "advancement_blocked")).toBe(true);
  });
});

describe("outcome-validation — module coverage", () => {
  it("defines 6 validation statuses and 7 false progress patterns", async () => {
    expect(VALIDATION_STATUSES).toHaveLength(6);
    const { FALSE_PROGRESS_PATTERNS } = await import(
      "../../../engines/outcome/FalseProgressDetector.js"
    );
    expect(FALSE_PROGRESS_PATTERNS).toHaveLength(7);
  });

  it("CorrectionPathGenerator emits correction_task_requested for UNVALIDATED", async () => {
    mockState.writeEventCalls = [];
    const result = await CorrectionPathGenerator.generate({
      userId: "user-1",
      blueprintId: "bp-1",
      targetId: "target-1",
      status: "UNVALIDATED",
      scoring: {
        evidenceScore: 5,
        outcomeMovementScore: 0,
        alignmentScore: 10,
        contradictionScore: 0,
        confidence: "low",
      },
    });

    expect(result?.correctionPathId).toContain("correction:");
    expect(
      mockState.writeEventCalls.some((e) => e.eventType === "correction_task_requested"),
    ).toBe(true);
  });

  it("OutcomeBlockingEnforcer applies all rule checks", async () => {
    mockState.openFlags = [];
    const enforcement = await OutcomeBlockingEnforcer.enforce({
      userId: "user-1",
      blueprintId: "bp-1",
      status: "PARTIALLY_VALIDATED",
    });

    expect(enforcement.targetCompletion.blocked).toBe(false);
    expect(enforcement.dashboardCopy.blocked).toBe(true);
  });
});
