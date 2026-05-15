/** Prompt 9 §1 — trace evidence for E2E reports. */
export interface Phase9TraceEvidence {
  traceId: string;
  eventIds: string[];
  stateVersion?: number;
  blueprintId?: string;
  userId?: string;
}

export function newTraceId(prefix = "p9"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildTraceEvidence(params: Partial<Phase9TraceEvidence> & { traceId: string }): Phase9TraceEvidence {
  return {
    traceId: params.traceId,
    eventIds: params.eventIds ?? [],
    stateVersion: params.stateVersion,
    blueprintId: params.blueprintId,
    userId: params.userId,
  };
}
