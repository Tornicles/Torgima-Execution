/**
 * TORGIMA P4 — execution-bound academy tasks (no optional browsing).
 */
import { db, academyTasks, academyProof, orders, feedback } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { TorgimaError } from "../../lib/errors.js";
import { evidenceLedgerService } from "../../services/erector/evidence/EvidenceLedgerService.js";

export async function detectRepeatedFailurePattern(
  userId: string,
  blueprintId: string,
  taskType: string,
): Promise<{ count: number; detected: boolean }> {
  const twoWeeks = new Date(Date.now() - 14 * 86400000);
  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(
        eq(feedback.user_id, userId),
        eq(feedback.blueprint_id, blueprintId),
        eq(orders.task_type, taskType as (typeof orders.task_type.enumValues)[number]),
        eq(feedback.completion_status, "failed"),
        gte(feedback.created_at, twoWeeks),
      ),
    );

  return { count: rows.length, detected: rows.length >= 3 };
}

export async function createAcademyTask(params: {
  blueprintId: string;
  userId: string;
  orderId: string;
  reason: string;
  skillTarget: string;
  blocksExecution?: boolean;
}): Promise<{ academyTaskId: string }> {
  const [existing] = await db
    .select({ id: academyTasks.id })
    .from(academyTasks)
    .where(
      and(
        eq(academyTasks.order_id, params.orderId),
        eq(academyTasks.status, "pending"),
      ),
    )
    .limit(1);

  if (existing) return { academyTaskId: existing.id };

  const learningContent =
    `Focused learning for ${params.skillTarget}. Apply this skill on your next execution task.`;

  const [task] = await db
    .insert(academyTasks)
    .values({
      blueprint_id: params.blueprintId,
      user_id: params.userId,
      order_id: params.orderId,
      title: `Learn: ${params.skillTarget}`,
      learning_content: learningContent,
      trigger_reason: params.reason,
      skill_target: params.skillTarget,
      proof_required: true,
      proof_description: "Submit a reflection (50+ chars) or proof you applied the skill.",
      status: "pending",
      blocks_execution: params.blocksExecution ?? true,
    })
    .returning({ id: academyTasks.id });

  if (!task) throw new TorgimaError("INTERNAL_ERROR", "Failed to create academy task");

  if (params.blocksExecution !== false) {
    await db
      .update(orders)
      .set({
        blocker_type: "academy",
        blocker_description: "Complete academy proof before continuing this task",
      })
      .where(eq(orders.id, params.orderId));
  }

  logger.info(
    { academyTaskId: task.id, orderId: params.orderId, reason: params.reason },
    "[AcademyEngine] Task created",
  );

  return { academyTaskId: task.id };
}

export async function validateAcademyProof(
  academyTaskId: string,
  proofData: { reflection?: string; outputUrl?: string },
): Promise<{ approved: boolean; reason?: string }> {
  const [task] = await db
    .select()
    .from(academyTasks)
    .where(eq(academyTasks.id, academyTaskId))
    .limit(1);

  if (!task) throw new TorgimaError("NOT_FOUND", "Academy task not found");

  const reflection = proofData.reflection?.trim() ?? "";
  const hasOutput = Boolean(proofData.outputUrl?.trim());
  const approved = reflection.length >= 50 || hasOutput;

  const proofJson = {
    output_url: proofData.outputUrl ?? null,
    reflection: reflection || null,
    type: hasOutput ? undefined : "text_explanation",
  };

  const [proofRow] = await db
    .insert(academyProof)
    .values({
      academy_task_id: academyTaskId,
      user_id: task.user_id,
      reflection: reflection || null,
      proof_json: proofJson,
      validation_status: approved ? "approved" : "rejected",
      rejection_reason: approved ? null : "Proof must be 50+ characters or include execution output",
      validated_at: new Date(),
    })
    .returning({ id: academyProof.id });

  if (!approved) {
    return { approved: false, reason: "Proof must demonstrate applied learning (50+ chars or output)" };
  }

  if (proofRow && task.capability_gap_id) {
    const { validateErectorAcademyProof } = await import(
      "../erector/academy/AcademyProofValidator.js"
    );
    const erectorResult = await validateErectorAcademyProof({
      academyTaskId,
      userId: task.user_id,
      academyProofId: proofRow.id,
      proofJson,
      reflection,
    });

    if (!erectorResult.validated) {
      await db
        .update(academyProof)
        .set({
          validation_status: "rejected",
          rejection_reason: "Evidence does not meet capability proof requirements",
        })
        .where(eq(academyProof.id, proofRow.id));
      return {
        approved: false,
        reason: "Evidence does not meet capability proof requirements",
      };
    }

    if (!erectorResult.capability_confirmed) {
      return {
        approved: true,
        reason: "Evidence recorded; continue building capability signal",
      };
    }
  } else if (proofRow) {
    try {
      const evidenceResult = await evidenceLedgerService.submit({
        userId: task.user_id,
        blueprintId: task.blueprint_id,
        academyTaskId,
        sourceType: "user_upload",
        contentJson: proofJson,
        contentSummary: reflection.substring(0, 200),
      });
      await db
        .update(academyProof)
        .set({
          evidence_ledger_id: evidenceResult.evidence_id,
          evidence_class: evidenceResult.evidence_class,
        })
        .where(eq(academyProof.id, proofRow.id));
    } catch (err) {
      logger.warn({ err, academyTaskId }, "[AcademyEngine] Evidence ledger submit failed");
    }
  }

  await db
    .update(academyTasks)
    .set({ status: "completed", completed_at: new Date() })
    .where(eq(academyTasks.id, academyTaskId));

  if (task.order_id && task.blocks_execution) {
    await db
      .update(orders)
      .set({ blocker_type: null, blocker_description: null })
      .where(eq(orders.id, task.order_id));
  }

  return { approved: true };
}

export async function handleRepeatedFailureAcademy(params: {
  userId: string;
  blueprintId: string;
  orderId: string;
  taskType: string;
}): Promise<void> {
  const pattern = await detectRepeatedFailurePattern(
    params.userId,
    params.blueprintId,
    params.taskType,
  );
  if (!pattern.detected) return;

  await createAcademyTask({
    blueprintId: params.blueprintId,
    userId: params.userId,
    orderId: params.orderId,
    reason: "repeated_failure",
    skillTarget: params.taskType,
    blocksExecution: true,
  });
}

export const AcademyEngine = {
  detectRepeatedFailurePattern,
  createAcademyTask,
  validateAcademyProof,
  handleRepeatedFailureAcademy,
};
