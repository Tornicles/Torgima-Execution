import { describe, expect, it, vi } from "vitest";
import {
  applyLedgerEvidenceAdjustments,
  applySignalMovementBonus,
  scoreOutcomeDimensions,
} from "../../../engines/outcome/outcomeScoring.js";
import {
  detectGlobalFalseProgressPatterns,
  calculateFalseProgressScore,
  runFalseProgressDetection,
} from "../../../engines/erector/FalseProgressEngine.js";
import {
  evaluateArchetypePattern,
  evaluateArchetypePatterns,
} from "../../../engines/erector/EconomicFalseProgressPatternLibrary.js";
import { ledgerOverridesFeedbackStrength } from "../../../engines/outcome/outcomeEvidenceMerge.js";

vi.mock("@workspace/db", () => {
  const emptyRows: unknown[] = [];
  const chain: {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>;
  } = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve) => Promise.resolve(emptyRows).then(resolve),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue([]);

  return {
    db: { select: vi.fn(() => chain) },
    falseProgressFlags: {},
    erectorPhaseGates: {},
  };
});

vi.mock("../../../services/EventService.js", () => ({
  EVENT_TYPES: {
    ADVANCEMENT_BLOCKED: "advancement_blocked",
    REWARD_EVALUATION_BLOCKED: "reward_evaluation_blocked",
    IDENTITY_ADVANCEMENT_BLOCKED: "identity_advancement_blocked",
  },
  writeEvent: vi.fn(async () => "evt-1"),
}));

import {
  enforceDashboardSuccessCopy,
  enforceOutcomeReward,
  enforcePhaseAdvancement,
  enforceTargetCompletion,
} from "../../../engines/erector/OutcomeBlockingEnforcer.js";

describe("outcome-validation scoring extensions", () => {
  it("VALIDATED when PAYMENT_PROOF ledger evidence boosts score", () => {
    const base = scoreOutcomeDimensions({
      evidenceTextLength: 120,
      hasProof: true,
      completionCount: 4,
      avgScore: 8,
      targetProgressRatio: 0.8,
      linkedToTarget: true,
    });

    const adjusted = applyLedgerEvidenceAdjustments(base.evidenceScore, [
      {
        evidence_strength: "HIGH",
        contradiction_status: null,
        validation_status: "validated",
        integrity_flags: [],
      },
    ]);

    const withOverride = ledgerOverridesFeedbackStrength(
      [{ evidence_class: "PAYMENT_PROOF" } as never],
      adjusted,
    );

    expect(withOverride).toBeGreaterThanOrEqual(75);
  });

  it("applies demand and outcome movement signal bonuses", () => {
    const base = scoreOutcomeDimensions({
      evidenceTextLength: 80,
      hasProof: true,
      completionCount: 3,
      avgScore: 7,
      targetProgressRatio: 0.5,
      linkedToTarget: true,
    });

    const boosted = applySignalMovementBonus(base.outcomeMovementScore, 15, 75);
    expect(boosted).toBeGreaterThan(base.outcomeMovementScore);
  });
});

describe("false-progress engine", () => {
  it("ACTIVITY_WITHOUT_OUTCOME when 12 tasks completed with low movement", () => {
    const patterns = detectGlobalFalseProgressPatterns({
      blueprintId: "bp-1",
      tasksCompleted7Days: 12,
      blueprintActiveDays: 10,
      evidenceScore: 15,
      outcomeMovementScore: 5,
      outcomeMovementSignal: 10,
      alignmentScore: 20,
      claimedOutcome: true,
      hasProof: false,
      avgScore: 6,
      wrongWork: false,
      vanityMetricUntied: false,
      repeatedLowScoreCompletions: 0,
      consecutiveLowMovementValidations: 0,
      ledgerEvidence: [],
    });

    expect(patterns.some((pattern) => pattern.pattern_id === "ACTIVITY_WITHOUT_OUTCOME")).toBe(
      true,
    );
    expect(patterns.some((pattern) => pattern.pattern_id === "PROOF_WEAK")).toBe(true);
    const score = calculateFalseProgressScore(patterns);
    expect(score).toBeGreaterThan(30);
  });

  it("SaaS features_without_retained_users pattern triggers HIGH severity", () => {
    const pattern = {
      pattern_id: "FP-saas-01",
      archetype: "saas_platform",
      pattern_name: "features_without_retained_users",
      pattern_description: "Shipping features without retention improvement",
      detection_logic: "Feature shipped, 7-day retention below 20%",
      example: "Launched 3 features, DAU declining",
      response_action: "Block phase advance until retention proof submitted",
      severity: "HIGH",
    };

    const result = evaluateArchetypePattern(pattern, {
      featuresShipped: 3,
      retention7d: 15,
    });

    expect(result.triggered).toBe(true);

    const triggered = evaluateArchetypePatterns([pattern], {
      featuresShipped: 3,
      retention7d: 15,
    });
    expect(triggered[0]?.pattern_id).toBe("FP-saas-01");
    expect(triggered[0]?.severity).toBe("HIGH");
  });

  it("CLAIM_CONTRADICTED creates CRITICAL score immediately", async () => {
    const result = await runFalseProgressDetection({
      blueprintId: "bp-1",
      tasksCompleted7Days: 2,
      blueprintActiveDays: 5,
      evidenceScore: 50,
      outcomeMovementScore: 40,
      outcomeMovementSignal: 40,
      alignmentScore: 50,
      claimedOutcome: true,
      hasProof: true,
      avgScore: 7,
      wrongWork: false,
      vanityMetricUntied: false,
      repeatedLowScoreCompletions: 0,
      consecutiveLowMovementValidations: 0,
      ledgerEvidence: [{ contradiction_status: "confirmed" } as never],
      archetypePatterns: [],
    });

    expect(
      result.patterns_triggered.some((pattern) => pattern.pattern_id === "CLAIM_CONTRADICTED"),
    ).toBe(true);
    expect(result.should_create_flag).toBe(true);
    expect(result.false_progress_score).toBeGreaterThanOrEqual(40);
  });
});

describe("outcome-validation blocking rules", () => {
  it("allows target completion only for validated outcomes", async () => {
    const allowed = await enforceTargetCompletion({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: "VALIDATED",
    });
    const blocked = await enforceTargetCompletion({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: "UNVALIDATED",
    });

    expect(allowed.blocked).toBe(false);
    expect(blocked.blocked).toBe(true);
  });

  it("blocks dashboard success copy unless validated", () => {
    expect(enforceDashboardSuccessCopy("VALIDATED").blocked).toBe(false);
    expect(enforceDashboardSuccessCopy("NEEDS_MORE_EVIDENCE").blocked).toBe(true);
  });

  it("phase advancement passes when no severe flags or blocked gates", async () => {
    const result = await enforcePhaseAdvancement({ blueprintId: "bp-1", userId: "user-1" });
    expect(result.blocked).toBe(false);
  });

  it("reward evaluation blocked for contradicted validation", async () => {
    const result = await enforceOutcomeReward({
      blueprintId: "bp-1",
      userId: "user-1",
      validationStatus: "CONTRADICTED",
    });
    expect(result.blocked).toBe(true);
  });
});

describe("doc-20 compatibility", () => {
  it("preserves seven legacy false progress pattern names", async () => {
    const { FALSE_PROGRESS_PATTERNS } = await import(
      "../../../engines/intelligence/FalseProgressDetectionEngine.js"
    );
    expect(FALSE_PROGRESS_PATTERNS).toContain("ACTIVITY_WITHOUT_OUTCOME");
    expect(FALSE_PROGRESS_PATTERNS).toContain("CLAIM_CONTRADICTED");
    expect(FALSE_PROGRESS_PATTERNS.length).toBe(7);
  });
});
