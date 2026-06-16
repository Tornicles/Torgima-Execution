import { and, eq, sql } from "drizzle-orm";
import {
  academyProof,
  academyTasks,
  db,
  erectorCapabilityGaps,
  erectorCapabilityProfiles,
} from "@workspace/db";
import { evidenceLedgerService } from "../../../services/erector/evidence/EvidenceLedgerService.js";
import { EVENT_TYPES, writeEvent } from "../../../services/EventService.js";
import { loadCapabilityGraphNode } from "./AcademyContentSelector.js";
import type { AcademyProofValidationResult } from "./types.js";

const STRENGTH_RANK: Record<string, number> = {
  NONE: 0,
  LOW: 1,
  "LOW-MEDIUM": 2,
  MEDIUM: 3,
  "MEDIUM-HIGH": 4,
  HIGH: 5,
};

function evidenceStrengthMeetsMinimum(
  strength: string,
  minimum: "MEDIUM" | "HIGH" = "MEDIUM",
): boolean {
  return (STRENGTH_RANK[strength.toUpperCase()] ?? 0) >= STRENGTH_RANK[minimum];
}

export async function calculateCapabilitySignal(
  userId: string,
  capabilityId: string,
  evidenceStrength: string,
): Promise<number> {
  const [profile] = await db
    .select({ capability_signal: erectorCapabilityProfiles.capability_signal })
    .from(erectorCapabilityProfiles)
    .where(
      and(
        eq(erectorCapabilityProfiles.user_id, userId),
        eq(erectorCapabilityProfiles.capability_id, capabilityId),
      ),
    )
    .limit(1);

  const base = profile?.capability_signal ?? 20;
  const bonus =
    evidenceStrength === "HIGH"
      ? 45
      : evidenceStrength === "MEDIUM-HIGH"
        ? 35
        : evidenceStrength === "MEDIUM"
          ? 25
          : 10;

  return Math.min(100, base + bonus);
}

export async function validateErectorAcademyProof(input: {
  academyTaskId: string;
  userId: string;
  academyProofId: string;
  proofJson: Record<string, unknown>;
  reflection: string;
}): Promise<AcademyProofValidationResult> {
  const [task] = await db
    .select()
    .from(academyTasks)
    .where(
      and(eq(academyTasks.id, input.academyTaskId), eq(academyTasks.user_id, input.userId)),
    )
    .limit(1);

  if (!task?.capability_gap_id) {
    return {
      validated: false,
      evidence_id: null,
      capability_confirmed: false,
      signal_validated: false,
    };
  }

  const [gap] = await db
    .select()
    .from(erectorCapabilityGaps)
    .where(eq(erectorCapabilityGaps.id, task.capability_gap_id))
    .limit(1);

  if (!gap) {
    return {
      validated: false,
      evidence_id: null,
      capability_confirmed: false,
      signal_validated: false,
    };
  }

  const capabilityNode = await loadCapabilityGraphNode(gap.capability_id);
  if (!capabilityNode) {
    return {
      validated: false,
      evidence_id: null,
      capability_confirmed: false,
      signal_validated: false,
    };
  }

  const evidence = await evidenceLedgerService.submit({
    userId: input.userId,
    blueprintId: task.blueprint_id,
    academyTaskId: input.academyTaskId,
    sourceType: "user_upload",
    contentJson: input.proofJson,
    contentSummary: input.reflection.substring(0, 300),
  });

  const evidenceMeetsRequirement =
    capabilityNode.evidence_types_allowed.includes(evidence.evidence_class) &&
    evidenceStrengthMeetsMinimum(evidence.evidence_strength, "MEDIUM");

  await db
    .update(academyProof)
    .set({
      evidence_ledger_id: evidence.evidence_id,
      evidence_class: evidence.evidence_class,
      signal_validated: evidenceMeetsRequirement,
      capability_confirmed: false,
    })
    .where(eq(academyProof.id, input.academyProofId));

  await db
    .update(academyTasks)
    .set({ erector_evidence_id: evidence.evidence_id })
    .where(eq(academyTasks.id, input.academyTaskId));

  if (!evidenceMeetsRequirement) {
    return {
      validated: false,
      evidence_id: evidence.evidence_id,
      capability_confirmed: false,
      signal_validated: false,
    };
  }

  const [existingProfile] = await db
    .select({ proof_count: erectorCapabilityProfiles.proof_count })
    .from(erectorCapabilityProfiles)
    .where(
      and(
        eq(erectorCapabilityProfiles.user_id, input.userId),
        eq(erectorCapabilityProfiles.capability_id, gap.capability_id),
      ),
    )
    .limit(1);

  const newSignalValue = await calculateCapabilitySignal(
    input.userId,
    gap.capability_id,
    evidence.evidence_strength,
  );
  const meetsSignalThreshold = newSignalValue >= capabilityNode.minimum_signal_threshold;

  if (!meetsSignalThreshold) {
    if (existingProfile) {
      await db
        .update(erectorCapabilityProfiles)
        .set({
          capability_signal: newSignalValue,
          signal_confidence: "MEDIUM",
          updated_at: new Date(),
        })
        .where(
          and(
            eq(erectorCapabilityProfiles.user_id, input.userId),
            eq(erectorCapabilityProfiles.capability_id, gap.capability_id),
          ),
        );
    } else {
      await db.insert(erectorCapabilityProfiles).values({
        user_id: input.userId,
        blueprint_id: task.blueprint_id,
        capability_id: gap.capability_id,
        proof_level: "partial",
        proof_count: 0,
        capability_signal: newSignalValue,
        signal_confidence: "MEDIUM",
      });
    }

    return {
      validated: true,
      evidence_id: evidence.evidence_id,
      capability_confirmed: false,
      signal_validated: true,
    };
  }

  const proofCount = (existingProfile?.proof_count ?? 0) + 1;

  if (existingProfile) {
    await db
      .update(erectorCapabilityProfiles)
      .set({
        proof_level: "proven",
        proof_count: proofCount,
        last_proof_evidence_id: evidence.evidence_id,
        last_proven_at: new Date(),
        capability_signal: newSignalValue,
        signal_confidence: "HIGH",
        decay_status: "current",
        updated_at: new Date(),
      })
      .where(
        and(
          eq(erectorCapabilityProfiles.user_id, input.userId),
          eq(erectorCapabilityProfiles.capability_id, gap.capability_id),
        ),
      );
  } else {
    await db.insert(erectorCapabilityProfiles).values({
      user_id: input.userId,
      blueprint_id: task.blueprint_id,
      capability_id: gap.capability_id,
      proof_level: "proven",
      proof_count: proofCount,
      last_proof_evidence_id: evidence.evidence_id,
      last_proven_at: new Date(),
      capability_signal: newSignalValue,
      signal_confidence: "HIGH",
    });
  }

  await db
    .update(erectorCapabilityGaps)
    .set({ status: "proven", resolved_at: new Date() })
    .where(eq(erectorCapabilityGaps.id, gap.id));

  await db
    .update(academyProof)
    .set({ capability_confirmed: true })
    .where(eq(academyProof.id, input.academyProofId));

  await writeEvent({
    eventType: EVENT_TYPES.ERECTOR_CAPABILITY_GAP_RESOLVED,
    entityType: "erector_capability_gap",
    entityId: gap.id,
    userId: input.userId,
    blueprintId: task.blueprint_id,
    payload: {
      capability_id: gap.capability_id,
      academy_task_id: task.id,
      capability_signal: newSignalValue,
    },
    idempotencyKey: `erector_capability_gap_resolved:${gap.id}`,
  }).catch(() => null);

  return {
    validated: true,
    evidence_id: evidence.evidence_id,
    capability_confirmed: true,
    signal_validated: true,
  };
}

export async function hasOpenHardCapabilityGap(
  userId: string,
  blueprintId: string,
  capabilityId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: erectorCapabilityGaps.id })
    .from(erectorCapabilityGaps)
    .where(
      and(
        eq(erectorCapabilityGaps.user_id, userId),
        eq(erectorCapabilityGaps.blueprint_id, blueprintId),
        eq(erectorCapabilityGaps.capability_id, capabilityId),
        eq(erectorCapabilityGaps.block_level, "hard"),
        sql`${erectorCapabilityGaps.status} IN ('open', 'in_academy')`,
      ),
    )
    .limit(1);

  return Boolean(row);
}
