import { db, feedback, targets, outcomeValidations, falseProgressFlags } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export type ValidationStatus =
  | "VALIDATED"
  | "PARTIALLY_VALIDATED"
  | "NEEDS_MORE_EVIDENCE"
  | "UNVALIDATED"
  | "CONTRADICTED"
  | "FALSE_PROGRESS";

function proofKeys(p: unknown): number {
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return Object.keys(p as Record<string, unknown>).length;
  }
  return 0;
}

export async function validateOutcome(params: {
  userId:        string;
  blueprintId:   string;
  targetId?:     string;
  claimText?:    string;
  evidenceText?: string;
  sourceType:    string;
  sourceId:      string;
}): Promise<{
  status: ValidationStatus;
  evidenceScore: number;
  outcomeMovementScore: number;
}> {
  let evidenceScore = 0;
  let outcomeMovementScore = 0;

  const recentFeedback = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, new Date(Date.now() - 14 * 86400000)),
      ),
    )
    .orderBy(desc(feedback.created_at))
    .limit(20);

  const completionCount = recentFeedback.filter(
    f => f.completion_status === "completed",
  ).length;
  const hasProof = recentFeedback.some(f => proofKeys(f.proof_json) > 0);
  const avgScore =
    recentFeedback.length > 0
      ? recentFeedback.reduce((s, f) => s + (f.score ?? 0), 0) / recentFeedback.length
      : 0;

  if (params.evidenceText && params.evidenceText.length > 50) evidenceScore += 30;
  if (hasProof) evidenceScore += 40;
  if (completionCount >= 3) evidenceScore += 20;
  if (avgScore >= 7) evidenceScore += 10;

  if (params.targetId) {
    const [target] = await db
      .select()
      .from(targets)
      .where(eq(targets.id, params.targetId))
      .limit(1);
    if (target?.target_value) {
      const movement =
        (target.current_value ?? 0) / Math.max(1, target.target_value ?? 1);
      outcomeMovementScore = Math.min(100, movement * 100);
    } else {
      outcomeMovementScore = Math.min(100, completionCount * 10);
    }
  } else {
    outcomeMovementScore = Math.min(100, completionCount * 10);
  }

  let status: ValidationStatus;

  if (evidenceScore >= 70 && outcomeMovementScore >= 70) {
    status = "VALIDATED";
  } else if (evidenceScore >= 40 && outcomeMovementScore >= 40) {
    status = "PARTIALLY_VALIDATED";
  } else if (
    evidenceScore < 20 &&
    outcomeMovementScore < 20 &&
    completionCount >= 5
  ) {
    status = "FALSE_PROGRESS";
    await createFalseProgressFlag({
      userId:       params.userId,
      blueprintId:  params.blueprintId,
      targetId:     params.targetId,
      flagType:     "ACTIVITY_WITHOUT_OUTCOME",
    });
  } else if (evidenceScore < 20) {
    status = "NEEDS_MORE_EVIDENCE";
  } else {
    status = "UNVALIDATED";
  }

  const missing =
    evidenceScore < 70 ? ["Specific proof of outcome", "Measurable result"] : [];

  const confidence =
    evidenceScore >= 70 ? "high" : evidenceScore >= 40 ? "medium" : "low";

  await db.insert(outcomeValidations).values({
    blueprint_id:       params.blueprintId,
    user_id:            params.userId,
    tasks_completed:    completionCount,
    outcomes_verified:  Math.round(outcomeMovementScore),
    alignment_score:    evidenceScore,
    verdict:            status,
    notes: JSON.stringify({
      source_type:            params.sourceType,
      source_id:              params.sourceId,
      target_id:              params.targetId,
      claim_text:             params.claimText,
      outcome_movement_score: outcomeMovementScore,
      evidence_summary:
        params.evidenceText?.slice(0, 500) ?? "No evidence text submitted",
      missing_evidence:     missing,
      confidence,
    }),
  });

  logger.info(
    { blueprintId: params.blueprintId, status, evidenceScore, outcomeMovementScore },
    "[OutcomeEngine] Validation complete",
  );

  return { status, evidenceScore, outcomeMovementScore };
}

async function createFalseProgressFlag(params: {
  userId:      string;
  blueprintId: string;
  targetId?:   string;
  flagType:    string;
}): Promise<void> {
  const [existing] = await db
    .select()
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, params.blueprintId),
        eq(falseProgressFlags.resolved, false),
        eq(falseProgressFlags.detection_type, params.flagType),
      ),
    )
    .limit(1);

  if (existing) return;

  await db.insert(falseProgressFlags).values({
    user_id:       params.userId,
    blueprint_id:  params.blueprintId,
    detection_type: params.flagType,
    severity:       "medium",
    resolved:       false,
    evidence_json: {
      target_id: params.targetId,
      created_from: "outcome_validation",
    },
  });

  await writeEvent({
    eventType:      EVENT_TYPES.FALSE_PROGRESS_DETECTED,
    entityType:     "blueprint",
    entityId:       params.blueprintId,
    userId:         params.userId,
    blueprintId:    params.blueprintId,
    payload:        { flag_type: params.flagType },
    idempotencyKey: `false_progress:${params.blueprintId}:${params.flagType}:${Math.floor(Date.now() / 86400000)}`,
  }).catch(() => null);

  logger.warn(
    { blueprintId: params.blueprintId, flagType: params.flagType },
    "[OutcomeEngine] False progress flag created",
  );
}

export async function resolveFlag(flagId: string, resolutionNote?: string): Promise<void> {
  const [row] = await db
    .select({ evidence_json: falseProgressFlags.evidence_json })
    .from(falseProgressFlags)
    .where(eq(falseProgressFlags.id, flagId))
    .limit(1);

  const prev =
    row?.evidence_json && typeof row.evidence_json === "object" && !Array.isArray(row.evidence_json)
      ? (row.evidence_json as Record<string, unknown>)
      : {};

  await db
    .update(falseProgressFlags)
    .set({
      resolved: true,
      evidence_json: {
        ...prev,
        ...(resolutionNote ? { resolution_note: resolutionNote, resolved_at: new Date().toISOString() } : {}),
      },
    })
    .where(eq(falseProgressFlags.id, flagId));
}

export async function getOpenFlags(blueprintId: string) {
  return db
    .select()
    .from(falseProgressFlags)
    .where(
      and(
        eq(falseProgressFlags.blueprint_id, blueprintId),
        eq(falseProgressFlags.resolved, false),
      ),
    )
    .orderBy(desc(falseProgressFlags.created_at));
}
