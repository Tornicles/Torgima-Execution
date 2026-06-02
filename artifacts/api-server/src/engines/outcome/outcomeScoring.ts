/**
 * Phase 3 DOC 20 — four validation scoring dimensions (0–100).
 */

export interface OutcomeScoreBundle {
  evidenceScore: number;
  outcomeMovementScore: number;
  alignmentScore: number;
  contradictionScore: number;
}

export function scoreOutcomeDimensions(params: {
  evidenceTextLength: number;
  hasProof: boolean;
  completionCount: number;
  avgScore: number;
  targetProgressRatio: number;
  linkedToTarget: boolean;
  claimContradicted?: boolean;
}): OutcomeScoreBundle {
  let evidenceScore = 0;
  if (params.evidenceTextLength > 50) evidenceScore += 25;
  if (params.evidenceTextLength > 150) evidenceScore += 15;
  if (params.hasProof) evidenceScore += 40;
  if (params.completionCount >= 3) evidenceScore += 15;
  if (params.avgScore >= 7) evidenceScore += 10;
  evidenceScore = Math.min(100, evidenceScore);

  const outcomeMovementScore = Math.min(
    100,
    Math.round(params.targetProgressRatio * 100 + params.completionCount * 3),
  );

  const alignmentScore = params.linkedToTarget
    ? Math.min(100, 50 + params.completionCount * 5)
    : Math.max(0, 30 - params.completionCount * 2);

  let contradictionScore = 0;
  if (params.claimContradicted) contradictionScore += 70;
  if (!params.hasProof && params.evidenceTextLength > 20) contradictionScore += 20;
  if (params.completionCount >= 5 && outcomeMovementScore < 15) contradictionScore += 25;
  contradictionScore = Math.min(100, contradictionScore);

  return {
    evidenceScore,
    outcomeMovementScore,
    alignmentScore,
    contradictionScore,
  };
}
