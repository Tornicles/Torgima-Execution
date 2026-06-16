/**
 * DOC20 Task 3 — four-dimension evidence scoring and status determination.
 */

import type {
  ExecutionDataSnapshot,
  LedgerEvidenceRow,
  OutcomeScoringResult,
  ValidationStatus,
} from "./outcomeTypes.js";
import type { FalseProgressDetectionResult } from "./FalseProgressDetector.js";

const STRENGTH_POINTS: Record<string, number> = {
  VERIFIED: 40,
  HIGH: 25,
  MEDIUM: 15,
  LOW: 5,
};

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreEvidenceFromLedger(records: LedgerEvidenceRow[]): number {
  let score = 0;
  let verifiedCount = 0;

  for (const record of records) {
    const strength = (record.evidence_strength ?? "").toUpperCase();
    if (strength === "VERIFIED") {
      verifiedCount += 1;
      score += STRENGTH_POINTS.VERIFIED;
    } else if (strength in STRENGTH_POINTS) {
      score += STRENGTH_POINTS[strength]!;
    }

    if (record.contradiction_status === "confirmed") {
      score = Math.max(0, score - 40);
    }

    const flags = record.integrity_flags ?? [];
    if (flags.includes("POSSIBLE_FABRICATION")) {
      score = Math.round(score * 0.3);
    }
    if (flags.includes("DUPLICATE_PROOF")) {
      score = Math.round(score * 0.7);
    }
  }

  if (verifiedCount >= 2) {
    score = Math.min(80, score);
  }

  return clamp(score);
}

function scoreOutcomeMovement(
  records: LedgerEvidenceRow[],
  execution: ExecutionDataSnapshot,
): number {
  let score = 0;

  const hasPayment = records.some((r) => r.evidence_class === "PAYMENT_PROOF");
  const hasExternal = records.some((r) => r.evidence_class === "EXTERNAL_CONFIRMATION");
  const hasAnalytics = records.some((r) => r.evidence_class === "ANALYTICS_MOVEMENT");

  if (hasPayment) score += 40;
  if (hasExternal) score += 30;
  if (hasAnalytics) score += 20;
  if (execution.completedCount7d >= 3) score += 10;

  return clamp(score);
}

function scoreAlignment(execution: ExecutionDataSnapshot): number {
  if (execution.totalTasks14d <= 0) return 0;
  return clamp((execution.alignedTasks14d / execution.totalTasks14d) * 100);
}

function scoreContradiction(
  records: LedgerEvidenceRow[],
  scoring: Pick<OutcomeScoringResult, "outcomeMovementScore">,
  execution: ExecutionDataSnapshot,
): number {
  let score = 0;

  if (records.some((r) => r.contradiction_status === "confirmed")) {
    score += 30;
  }
  if ((execution.demandSignalDelta ?? 0) < -20) {
    score += 20;
  }
  if ((execution.falseProgressSignal ?? 0) > 60) {
    score += 20;
  }
  if (execution.claimComplete && scoring.outcomeMovementScore < 15) {
    score += 30;
  }

  return clamp(score);
}

export class OutcomeEvidenceScorer {
  static score(
    evidence: LedgerEvidenceRow[],
    execution: ExecutionDataSnapshot,
  ): OutcomeScoringResult {
    const evidenceScore = scoreEvidenceFromLedger(evidence);
    const outcomeMovementScore = scoreOutcomeMovement(evidence, execution);
    const alignmentScore = scoreAlignment(execution);
    const contradictionScore = scoreContradiction(
      evidence,
      { outcomeMovementScore },
      execution,
    );

    const confidence: OutcomeScoringResult["confidence"] =
      evidenceScore >= 70 ? "high" : evidenceScore >= 40 ? "medium" : "low";

    return {
      evidenceScore,
      outcomeMovementScore,
      alignmentScore,
      contradictionScore,
      confidence,
    };
  }
}

export function determineValidationStatus(
  scoring: OutcomeScoringResult,
  falseProgress: FalseProgressDetectionResult,
  execution: ExecutionDataSnapshot,
): ValidationStatus {
  if (scoring.contradictionScore >= 60) {
    return "CONTRADICTED";
  }

  if (falseProgress.detected) {
    return "FALSE_PROGRESS";
  }

  if (
    scoring.evidenceScore >= 70 &&
    scoring.outcomeMovementScore >= 60 &&
    scoring.contradictionScore < 20
  ) {
    return "VALIDATED";
  }

  if (
    scoring.evidenceScore >= 40 &&
    scoring.outcomeMovementScore >= 30 &&
    scoring.contradictionScore < 40
  ) {
    return "PARTIALLY_VALIDATED";
  }

  if (execution.hasClaim && scoring.evidenceScore < 40) {
    return "NEEDS_MORE_EVIDENCE";
  }

  if (scoring.alignmentScore < 30 && execution.completedCount14d > 5) {
    return "FALSE_PROGRESS";
  }

  if (scoring.evidenceScore < 10) {
    return "UNVALIDATED";
  }

  return "NEEDS_MORE_EVIDENCE";
}

/** Legacy bundle scorer — kept for erector compatibility tests. */
export function scoreOutcomeDimensions(params: {
  evidenceTextLength: number;
  hasProof: boolean;
  completionCount: number;
  avgScore: number;
  targetProgressRatio: number;
  linkedToTarget: boolean;
  claimContradicted?: boolean;
}): Omit<OutcomeScoringResult, "confidence"> {
  let evidenceScore = 0;
  if (params.evidenceTextLength > 50) evidenceScore += 25;
  if (params.evidenceTextLength > 150) evidenceScore += 15;
  if (params.hasProof) evidenceScore += 40;
  if (params.completionCount >= 3) evidenceScore += 15;
  if (params.avgScore >= 7) evidenceScore += 10;

  const outcomeMovementScore = clamp(
    Math.round(params.targetProgressRatio * 100 + params.completionCount * 3),
  );
  const alignmentScore = params.linkedToTarget
    ? clamp(50 + params.completionCount * 5)
    : clamp(30 - params.completionCount * 2);

  let contradictionScore = 0;
  if (params.claimContradicted) contradictionScore += 70;
  if (!params.hasProof && params.evidenceTextLength > 20) contradictionScore += 20;
  if (params.completionCount >= 5 && outcomeMovementScore < 15) contradictionScore += 25;

  return {
    evidenceScore: clamp(evidenceScore),
    outcomeMovementScore,
    alignmentScore,
    contradictionScore: clamp(contradictionScore),
  };
}

export function applyLedgerEvidenceAdjustments(
  baseEvidenceScore: number,
  ledgerRecords: LedgerEvidenceRow[],
): number {
  let score = baseEvidenceScore;

  for (const record of ledgerRecords) {
    const strength = (record.evidence_strength ?? "").toUpperCase();
    if (strength === "HIGH") {
      score = Math.min(100, Math.round(score * 1.5));
    }
    if (strength === "HIGH" && record.validation_status === "validated") {
      score = Math.min(100, Math.round(score * 2.0));
    }
    if (record.contradiction_status === "confirmed") {
      score = Math.max(0, score - 30);
    }

    const flags = record.integrity_flags ?? [];
    if (flags.includes("POSSIBLE_FABRICATION")) {
      score = Math.round(score * 0.5);
    }
    if (flags.includes("DUPLICATE_PROOF")) {
      score = Math.round(score * 0.8);
    }
  }

  return clamp(score);
}

export function applySignalMovementBonus(
  outcomeMovementScore: number,
  demandSignalDelta: number,
  outcomeMovementSignal: number,
): number {
  let score = outcomeMovementScore;
  if (demandSignalDelta > 10) score += 10;
  if (outcomeMovementSignal > 70) score += 15;
  return clamp(score);
}
