import type { BeliefRecord, BeliefState } from "../contracts/types.js";

export interface EvolutionEvent {
  beliefId: string;
  changeType: "create" | "challenge" | "validate" | "replace";
  previousState?: BeliefState;
  newState: BeliefState;
  reason: string;
  confidenceBefore?: number;
  confidenceAfter?: number;
  qualityScore?: number;
}

export class BeliefEvolution {
  trackCreate(record: BeliefRecord): EvolutionEvent {
    return {
      beliefId: record.beliefId,
      changeType: "create",
      newState: record.state,
      reason: `Created ${record.type} from ${record.origin}`,
      confidenceAfter: record.confidence,
      qualityScore: record.confidence,
    };
  }

  challenge(record: BeliefRecord, reason: string): { record: BeliefRecord; event: EvolutionEvent } {
    const updated = {
      ...record,
      state: "HYPOTHESIZED" as const,
      confidence: record.confidence * 0.7,
    };
    return {
      record: updated,
      event: {
        beliefId: record.beliefId,
        changeType: "challenge",
        previousState: record.state,
        newState: "HYPOTHESIZED",
        reason,
        confidenceBefore: record.confidence,
        confidenceAfter: updated.confidence,
      },
    };
  }

  validate(record: BeliefRecord): { record: BeliefRecord; event: EvolutionEvent } {
    const updated = {
      ...record,
      state: "VALIDATED" as const,
      confidence: Math.min(1, record.confidence + 0.1),
    };
    return {
      record: updated,
      event: {
        beliefId: record.beliefId,
        changeType: "validate",
        previousState: record.state,
        newState: "VALIDATED",
        reason: "Evidence survived challenge",
        confidenceBefore: record.confidence,
        confidenceAfter: updated.confidence,
        qualityScore: updated.confidence,
      },
    };
  }

  replace(old: BeliefRecord, replacement: BeliefRecord): EvolutionEvent {
    return {
      beliefId: old.beliefId,
      changeType: "replace",
      previousState: old.state,
      newState: "DEPRECATED",
      reason: `Replaced by ${replacement.beliefId}`,
      confidenceBefore: old.confidence,
      confidenceAfter: replacement.confidence,
    };
  }
}

export const beliefEvolution = new BeliefEvolution();
