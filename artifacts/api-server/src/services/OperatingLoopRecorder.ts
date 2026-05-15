import { writeEvent, EVENT_TYPES } from "./EventService.js";

/** Named stages along the deterministic reality → adaptation chain (explainability / timeline). */
export type OperatingLoopStageKey =
  | "REALITY_EXECUTION_RECORDED"
  | "PROOF_FEEDBACK_INGESTED"
  | "SIGNAL_RECALCULATION_ENQUEUED"
  | "SIGNAL_MATHEMATICS_COMPUTED"
  | "CONDITION_COMMITTED"
  | "ENFORCEMENT_BOUND"
  | "TASK_GENERATION_COMPLETED"
  | "OPERATING_FEEDBACK_CLOSED";

export interface OperatingLoopStagePayload extends Record<string, unknown> {
  stage: OperatingLoopStageKey;
  loopSchemaVersion: 1;
  description: string;
  triggerEventType?: string;
  causation_event_id?: string;
}

/** Audit-only timeline events — never drive execution (workers use typed queues separately). */
export async function recordOperatingLoopStage(params: {
  blueprintId: string;
  userId: string;
  stage: OperatingLoopStageKey;
  description: string;
  causationEventId?: string;
  triggerEventType?: string;
  correlation?: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}): Promise<string | null> {
  try {
    const payload: OperatingLoopStagePayload = {
      stage: params.stage,
      loopSchemaVersion: 1,
      description: params.description,
      triggerEventType: params.triggerEventType,
      ...(params.causationEventId ? { causation_event_id: params.causationEventId } : {}),
      ...(params.correlation ?? {}),
    };

    return await writeEvent({
      eventType: EVENT_TYPES.OPERATING_LOOP_STAGE,
      entityType: params.entityType ?? "blueprint",
      entityId: params.entityId ?? params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload,
      idempotencyKey: `loop_stage:${params.blueprintId}:${params.stage}:${params.causationEventId ?? "no_cause"}`,
      causationEventId: params.causationEventId,
    });
  } catch {
    return null;
  }
}
