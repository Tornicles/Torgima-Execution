/**
 * DOC20 Task 6 — correction task generation for non-validated outcomes.
 */

import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import type { ValidationStatus } from "./outcomeTypes.js";
import type { FalseProgressPattern } from "./FalseProgressDetector.js";
import type { OutcomeScoringResult } from "./outcomeTypes.js";

export type CorrectionTaskSpec = {
  task_type: string;
  title: string;
  instruction: string;
  blocks_execution: boolean;
  proof_required: boolean;
};

export const CORRECTION_TASK_MAP: Record<
  Extract<ValidationStatus, "NEEDS_MORE_EVIDENCE" | "UNVALIDATED" | "CONTRADICTED" | "FALSE_PROGRESS">,
  CorrectionTaskSpec
> = {
  NEEDS_MORE_EVIDENCE: {
    task_type: "clarification",
    title: "Submit evidence for your progress",
    instruction:
      "Provide specific proof that demonstrates your stated outcome.",
    blocks_execution: false,
    proof_required: true,
  },
  UNVALIDATED: {
    task_type: "clarification",
    title: "Show your progress",
    instruction: "No evidence has been submitted. What has actually changed?",
    blocks_execution: false,
    proof_required: true,
  },
  CONTRADICTED: {
    task_type: "clarification",
    title: "Review and correct your progress claim",
    instruction:
      "Submitted evidence does not support the claimed outcome. Correct or replace your evidence.",
    blocks_execution: false,
    proof_required: true,
  },
  FALSE_PROGRESS: {
    task_type: "recovery",
    title: "Refocus on your real target",
    instruction:
      "Activity has been high but your target has not moved. Review what work actually drives your outcome.",
    blocks_execution: false,
    proof_required: true,
  },
};

const CORRECTION_STATUSES = new Set<ValidationStatus>([
  "NEEDS_MORE_EVIDENCE",
  "UNVALIDATED",
  "CONTRADICTED",
  "FALSE_PROGRESS",
]);

export class CorrectionPathGenerator {
  static specForStatus(status: ValidationStatus): CorrectionTaskSpec | null {
    if (!CORRECTION_STATUSES.has(status)) return null;
    return CORRECTION_TASK_MAP[status as keyof typeof CORRECTION_TASK_MAP];
  }

  static async generate(params: {
    userId: string;
    blueprintId: string;
    targetId?: string;
    status: ValidationStatus;
    scoring: OutcomeScoringResult;
    pattern?: FalseProgressPattern | null;
  }): Promise<{ correctionPathId: string } | null> {
    const spec = CorrectionPathGenerator.specForStatus(params.status);
    if (!spec) return null;

    const correctionPathId = `correction:${params.blueprintId}:${params.targetId ?? "blueprint"}:${params.status}`;
    const base = {
      userId: params.userId,
      blueprintId: params.blueprintId,
      entityType: "blueprint" as const,
      entityId: params.blueprintId,
    };

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.CORRECTION_TASK_REQUESTED,
      payload: {
        correction_path_id: correctionPathId,
        target_id: params.targetId,
        status: params.status,
        pattern: params.pattern,
        task_type: spec.task_type,
        title: spec.title,
        instruction: spec.instruction,
        blocks_execution: spec.blocks_execution,
        proof_required: spec.proof_required,
        evidence_score: params.scoring.evidenceScore,
        outcome_movement_score: params.scoring.outcomeMovementScore,
      },
      idempotencyKey: `correction_path:${correctionPathId}`,
    }).catch(() => null);

    if (params.status === "NEEDS_MORE_EVIDENCE" || params.status === "UNVALIDATED") {
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.EVIDENCE_SUBMISSION_TASK_REQUESTED,
        payload: { target_id: params.targetId, correction_path_id: correctionPathId },
        idempotencyKey: `evidence_submission:${correctionPathId}`,
      }).catch(() => null);
    }

    if (params.status === "FALSE_PROGRESS" && params.pattern === "ACTIVITY_WITHOUT_OUTCOME") {
      await writeEvent({
        ...base,
        eventType: EVENT_TYPES.PRIORITY_REVIEW_REQUESTED,
        payload: { blueprint_id: params.blueprintId, reason: "activity_without_outcome" },
        idempotencyKey: `priority_review:${correctionPathId}`,
      }).catch(() => null);
    }

    return { correctionPathId };
  }
}
