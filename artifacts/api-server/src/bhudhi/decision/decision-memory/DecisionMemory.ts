import type { DecisionRecord, DecisionResult } from "../contracts/types.js";

/** In-process decision memory cache (DB is source of truth via decisionData) */
export class DecisionMemory {
  private records = new Map<string, DecisionRecord>();

  store(result: DecisionResult, reason: string): DecisionRecord {
    const record: DecisionRecord = {
      decisionId: result.decisionId,
      timestamp: new Date().toISOString(),
      reason,
      winner: result.selected.option,
    };
    this.records.set(result.decisionId, record);
    return record;
  }

  get(decisionId: string): DecisionRecord | undefined {
    return this.records.get(decisionId);
  }

  updateOutcome(decisionId: string, actualOutcome: unknown, quality?: number): void {
    const r = this.records.get(decisionId);
    if (r) {
      r.actualOutcome = actualOutcome;
      if (quality !== undefined) {
        (r as DecisionRecord & { quality?: number }).quality = quality;
      }
    }
  }
}

export const decisionMemory = new DecisionMemory();
