import { and, eq, sql } from "drizzle-orm";

import { db, erectorEvidenceLedger } from "@workspace/db";

import {

  applyConfidenceImpact,

  integrityLayer,

  mergeIntegrityFlags,

} from "../../../engines/erector/IntegrityLayer.js";

import { classifyEvidence } from "./EvidenceClassifier.js";

import { scoreEvidenceStrength } from "./EvidenceStrengthScorer.js";

import type {

  EvidenceClass,

  EvidenceRecord,

  EvidenceStrength,

  SubmitEvidenceInput,

  SubmitEvidenceResult,

} from "./types.js";



export class EvidenceLedgerService {

  async submit(input: SubmitEvidenceInput): Promise<SubmitEvidenceResult> {

    const evidence_class = classifyEvidence(input.sourceType, input.contentJson);



    const existingEvidence = await integrityLayer.loadContext(input.userId, input.blueprintId);



    const integrityResult = await integrityLayer.evaluate(

      input.userId,

      input.blueprintId,

      { ...input, evidence_class },

      existingEvidence,

    );



    if (integrityResult.action === "evidence_rejected") {

      const [row] = await db

        .insert(erectorEvidenceLedger)

        .values({

          user_id: input.userId,

          blueprint_id: input.blueprintId ?? null,

          task_id: input.taskId ?? null,

          academy_task_id: input.academyTaskId ?? null,

          outcome_id: input.outcomeId ?? null,

          validation_run_id: input.validationRunId ?? null,

          source_type: input.sourceType,

          source_location: input.sourceLocation ?? null,

          evidence_class,

          evidence_strength: "NONE",

          content_json: input.contentJson,

          content_summary: input.contentSummary ?? null,

          validation_status: "rejected",

          rejection_reason: integrityResult.flags.join(", "),

          integrity_flags: integrityResult.flags,

        })

        .returning({ id: erectorEvidenceLedger.id });



      if (!row) throw new Error("Failed to write rejected evidence ledger entry");



      return {

        evidence_id: row.id,

        evidence_class,

        evidence_strength: "NONE",

        integrity_flags: mergeIntegrityFlags([], integrityResult.flags),

        rejected: true,

      };

    }



    const priorTaskCompletionCount = await this.countPriorEvidence(

      input.userId,

      "TASK_COMPLETION_COUNT",

      input.blueprintId,

    );

    const userHasHighEvidence = await this.userHasHighEvidence(input.userId, input.blueprintId);



    const scored = scoreEvidenceStrength({

      evidenceClass: evidence_class,

      sourceType: input.sourceType,

      contentJson: input.contentJson,

      contentSummary: input.contentSummary,

      priorTaskCompletionCount,

      userHasHighEvidence,

    });



    const adjustedStrength = applyConfidenceImpact(

      scored.evidence_strength,

      integrityResult.confidence_impact,

    );

    const integrityFlags = mergeIntegrityFlags(scored.integrity_flags, integrityResult.flags);



    const [row] = await db

      .insert(erectorEvidenceLedger)

      .values({

        user_id: input.userId,

        blueprint_id: input.blueprintId ?? null,

        task_id: input.taskId ?? null,

        academy_task_id: input.academyTaskId ?? null,

        outcome_id: input.outcomeId ?? null,

        validation_run_id: input.validationRunId ?? null,

        source_type: input.sourceType,

        source_location: input.sourceLocation ?? null,

        evidence_class,

        evidence_strength: adjustedStrength,

        content_json: input.contentJson,

        content_summary: input.contentSummary ?? null,

        integrity_flags: integrityFlags,

        validation_status: "pending",

      })

      .returning({ id: erectorEvidenceLedger.id });



    if (!row) throw new Error("Failed to write evidence ledger entry");



    return {
      evidence_id: row.id,
      evidence_class,
      evidence_strength: adjustedStrength,
      integrity_flags: integrityFlags,
    };
  }

  async getByTask(taskId: string, userId: string): Promise<EvidenceRecord[]> {
    return db
      .select()
      .from(erectorEvidenceLedger)
      .where(and(eq(erectorEvidenceLedger.task_id, taskId), eq(erectorEvidenceLedger.user_id, userId)));
  }

  async getById(evidenceId: string, userId: string): Promise<EvidenceRecord | null> {
    const [row] = await db
      .select()
      .from(erectorEvidenceLedger)
      .where(
        and(eq(erectorEvidenceLedger.id, evidenceId), eq(erectorEvidenceLedger.user_id, userId)),
      )
      .limit(1);
    return row ?? null;
  }

  async getByBlueprint(blueprintId: string, targetId?: string): Promise<EvidenceRecord[]> {
    const conditions = [eq(erectorEvidenceLedger.blueprint_id, blueprintId)];
    if (targetId) {
      conditions.push(eq(erectorEvidenceLedger.outcome_id, targetId));
    }
    return db.select().from(erectorEvidenceLedger).where(and(...conditions));
  }

  async getByAcademyTask(academyTaskId: string): Promise<EvidenceRecord[]> {
    return db
      .select()
      .from(erectorEvidenceLedger)
      .where(eq(erectorEvidenceLedger.academy_task_id, academyTaskId));
  }

  async markValidated(evidenceId: string, decisionId: string): Promise<void> {
    const [existing] = await db
      .select({ linked: erectorEvidenceLedger.linked_decision_ids })
      .from(erectorEvidenceLedger)
      .where(eq(erectorEvidenceLedger.id, evidenceId))
      .limit(1);

    const linked = [...(existing?.linked ?? []), decisionId];

    await db
      .update(erectorEvidenceLedger)
      .set({
        validation_status: "validated",
        validated_at: new Date(),
        linked_decision_ids: linked,
      })
      .where(eq(erectorEvidenceLedger.id, evidenceId));
  }

  async markContradicted(evidenceId: string, reason: string): Promise<void> {
    await db
      .update(erectorEvidenceLedger)
      .set({
        contradiction_status: "confirmed",
        validation_status: "contradicted",
        rejection_reason: reason,
      })
      .where(eq(erectorEvidenceLedger.id, evidenceId));
  }

  private async countPriorEvidence(
    userId: string,
    evidenceClass: EvidenceClass,
    blueprintId?: string,
  ): Promise<number> {
    const conditions = [
      eq(erectorEvidenceLedger.user_id, userId),
      eq(erectorEvidenceLedger.evidence_class, evidenceClass),
    ];
    if (blueprintId) {
      conditions.push(eq(erectorEvidenceLedger.blueprint_id, blueprintId));
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(erectorEvidenceLedger)
      .where(and(...conditions));

    return row?.count ?? 0;
  }

  private async userHasHighEvidence(userId: string, blueprintId?: string): Promise<boolean> {
    const conditions = [
      eq(erectorEvidenceLedger.user_id, userId),
      eq(erectorEvidenceLedger.evidence_strength, "HIGH"),
    ];
    if (blueprintId) {
      conditions.push(eq(erectorEvidenceLedger.blueprint_id, blueprintId));
    }

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(erectorEvidenceLedger)
      .where(and(...conditions));

    return (row?.count ?? 0) > 0;
  }
}

export const evidenceLedgerService = new EvidenceLedgerService();
