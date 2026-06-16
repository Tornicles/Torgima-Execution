/**
 * Phase 3 DOC 20 — re-exports for backward compatibility.
 */

export {
  OutcomeEvidenceScorer,
  determineValidationStatus,
  scoreOutcomeDimensions,
  applyLedgerEvidenceAdjustments,
  applySignalMovementBonus,
} from "./OutcomeEvidenceScorer.js";

export type { OutcomeScoringResult } from "./outcomeTypes.js";

/** @deprecated Use OutcomeScoringResult */
export interface OutcomeScoreBundle {
  evidenceScore: number;
  outcomeMovementScore: number;
  alignmentScore: number;
  contradictionScore: number;
}
