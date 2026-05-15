/**
 * Prompt 7 §3.1 — cue → action → proof → reward → identity → next action.
 * Records operating-loop stages; does not bypass control or invent rewards.
 */

import { recordOperatingLoopStage } from "../../services/OperatingLoopRecorder.js";
import { logger } from "../../lib/logger.js";

import type { OperatingLoopStageKey } from "../../services/OperatingLoopRecorder.js";

export type CompulsionLoopStage =
  | "REALITY_EXECUTION_RECORDED"
  | "PROOF_FEEDBACK_INGESTED"
  | "SIGNAL_RECALCULATION_ENQUEUED"
  | "TASK_GENERATION_COMPLETED";

export async function recordCompulsionLoopStage(params: {
  blueprintId: string;
  userId: string;
  stage: CompulsionLoopStage;
  entityType?: string;
  entityId?: string;
  causationEventId?: string;
  correlation?: Record<string, unknown>;
}): Promise<void> {
  const descriptions: Record<CompulsionLoopStage, string> = {
    REALITY_EXECUTION_RECORDED: "Proof and feedback recorded for the compulsion loop.",
    PROOF_FEEDBACK_INGESTED: "Feedback ingested; outcome validation may run on completed work.",
    SIGNAL_RECALCULATION_ENQUEUED: "Signals recalculated after verified execution.",
    TASK_GENERATION_COMPLETED: "Next action guaranteed by task generation.",
  };

  await recordOperatingLoopStage({
    blueprintId: params.blueprintId,
    userId: params.userId,
    stage: params.stage as OperatingLoopStageKey,
    description: descriptions[params.stage],
    causationEventId: params.causationEventId,
    entityType: params.entityType,
    entityId: params.entityId,
    correlation: params.correlation,
  }).catch((err) => {
    logger.warn({ err, stage: params.stage }, "[CompulsionLoop] Stage record failed");
  });
}
