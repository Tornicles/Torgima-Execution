import {
  db,
  feedback,
  targets,
  orders,
  blueprints,
  realOutcomes,
  outcomeValidations,
  falseProgressFlags,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { OrderStatus, TargetStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { TorgimaError } from "../../lib/errors.js";
import { detectFalseProgress } from "../intelligence/FalseProgressDetectionEngine.js";
import { scoreOutcomeDimensions } from "./outcomeScoring.js";
import { emitOutcomeCorrectionEvents } from "./outcomeCorrectionEvents.js";

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

  let targetProgressRatio = completionCount * 0.05;
  let linkedToTarget = Boolean(params.targetId);

  if (params.targetId) {
    const [target] = await db
      .select()
      .from(targets)
      .where(eq(targets.id, params.targetId))
      .limit(1);
    if (target?.target_value) {
      targetProgressRatio =
        (target.current_value ?? 0) / Math.max(1, target.target_value ?? 1);
    }
  }

  const scores = scoreOutcomeDimensions({
    evidenceTextLength: params.evidenceText?.length ?? 0,
    hasProof,
    completionCount,
    avgScore,
    targetProgressRatio,
    linkedToTarget,
    claimContradicted: false,
  });

  let evidenceScore = scores.evidenceScore;
  let outcomeMovementScore = scores.outcomeMovementScore;
  const alignmentScore = scores.alignmentScore;
  const contradictionScore = scores.contradictionScore;

  let status: ValidationStatus;
  let detectedPattern: import("../intelligence/FalseProgressDetectionEngine.js").FalseProgressPattern | null =
    null;

  if (contradictionScore >= 70) {
    status = "CONTRADICTED";
    detectedPattern = "CLAIM_CONTRADICTED";
  } else if (evidenceScore >= 70 && outcomeMovementScore >= 70) {
    status = "VALIDATED";
  } else if (evidenceScore >= 40 && outcomeMovementScore >= 40) {
    status = "PARTIALLY_VALIDATED";
  } else {
    const fp = detectFalseProgress({
      completionCount,
      evidenceScore,
      outcomeMovementScore,
      alignmentScore,
      hasProof,
      avgScore,
      claimContradicted: contradictionScore >= 70,
      wrongWork: alignmentScore < 25 && completionCount >= 3,
    });
    if (fp.detected && fp.pattern) {
      status = "FALSE_PROGRESS";
      detectedPattern = fp.pattern;
      await createFalseProgressFlag({
        userId: params.userId,
        blueprintId: params.blueprintId,
        targetId: params.targetId,
        flagType: fp.pattern,
        correctionTaskType: fp.correctionTaskType,
      });
    } else if (evidenceScore < 20) {
      status = "NEEDS_MORE_EVIDENCE";
    } else {
      status = "UNVALIDATED";
    }
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

  if (status === "CONTRADICTED") {
    await emitOutcomeCorrectionEvents({
      userId: params.userId,
      blueprintId: params.blueprintId,
      status: "CONTRADICTED",
      pattern: detectedPattern ?? "CLAIM_CONTRADICTED",
      targetId: params.targetId,
      sourceId: params.sourceId,
    }).catch(() => null);
    status = "FALSE_PROGRESS";
  }

  await emitOutcomeCorrectionEvents({
    userId: params.userId,
    blueprintId: params.blueprintId,
    status,
    pattern: status === "FALSE_PROGRESS" ? detectedPattern : null,
    targetId: params.targetId,
    sourceId: params.sourceId,
  }).catch(() => null);

  logger.info(
    {
      blueprintId: params.blueprintId,
      status,
      evidenceScore,
      outcomeMovementScore,
      alignmentScore,
      contradictionScore,
    },
    "[OutcomeEngine] Validation complete",
  );

  return { status, evidenceScore, outcomeMovementScore };
}

async function createFalseProgressFlag(params: {
  userId:             string;
  blueprintId:        string;
  targetId?:          string;
  flagType:           string;
  correctionTaskType?: string;
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
    user_id: params.userId,
    blueprint_id: params.blueprintId,
    detection_type: params.flagType,
    severity: "medium",
    status: "active",
    resolved: false,
    evidence_json: {
      target_id: params.targetId,
      created_from: "outcome_validation",
      correction_task_type: params.correctionTaskType ?? "clarification_task",
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
  const now = new Date();
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
      status: "resolved",
      resolved_at: now,
      evidence_json: {
        ...prev,
        ...(resolutionNote ? { resolution_note: resolutionNote, resolved_at: now.toISOString() } : {}),
      },
    })
    .where(eq(falseProgressFlags.id, flagId));
}

export async function resolveActiveFlagsForBlueprint(
  blueprintId: string,
  resolutionNote?: string,
): Promise<number> {
  const open = await getOpenFlags(blueprintId);
  for (const f of open) {
    await resolveFlag(f.id, resolutionNote);
  }
  return open.length;
}

export type Il2ValidationResult = "PASSED" | "FAILED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE";

function mapIl2ToVerdict(result: Il2ValidationResult): ValidationStatus {
  switch (result) {
    case "PASSED":
      return "VALIDATED";
    case "PARTIAL":
      return "PARTIALLY_VALIDATED";
    case "FAILED":
      return "UNVALIDATED";
    default:
      return "NEEDS_MORE_EVIDENCE";
  }
}

/** IL2 LAW 2 — phase advance requires a passed validation on record. */
export async function hasPassedOutcomeValidation(blueprintId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: outcomeValidations.id })
    .from(outcomeValidations)
    .where(
      and(
        eq(outcomeValidations.blueprint_id, blueprintId),
        or(
          eq(outcomeValidations.validation_result, "PASSED"),
          eq(outcomeValidations.verdict, "VALIDATED"),
        ),
      ),
    )
    .limit(1);
  return !!row;
}

/** IL2 LAW 1 — active false progress blocks phase/reward paths. */
export async function assertNoActiveFalseProgress(
  blueprintId: string,
  userId?: string,
): Promise<void> {
  const clauses = [
    eq(falseProgressFlags.blueprint_id, blueprintId),
    eq(falseProgressFlags.resolved, false),
  ];
  if (userId) clauses.push(eq(falseProgressFlags.user_id, userId));

  const [flag] = await db
    .select({ id: falseProgressFlags.id })
    .from(falseProgressFlags)
    .where(and(...clauses))
    .limit(1);

  if (flag) {
    throw new TorgimaError(
      "FALSE_PROGRESS_BLOCKED",
      "Phase advancement blocked: active false progress flag must be resolved first",
      false,
    );
  }
}

/** IL2 LAW 2 — phase gate after outcome validation has run. */
export async function assertPhaseAdvancementAllowed(
  blueprintId: string,
  userId: string,
): Promise<void> {
  await assertNoActiveFalseProgress(blueprintId, userId);

  const passed = await hasPassedOutcomeValidation(blueprintId);
  if (!passed) {
    throw new TorgimaError(
      "VALIDATION_ERROR",
      "Phase advancement requires at least one passed outcome validation for this blueprint",
      false,
    );
  }
}

export class OutcomeValidationEngine {
  async validate(input: {
    userId: string;
    blueprintId: string;
    phase?: string;
    trigger?: string;
  }): Promise<{ validationsCreated: number; falseProgressFlagged: boolean }> {
    const [bp] = await db
      .select({ created_at: blueprints.created_at })
      .from(blueprints)
      .where(eq(blueprints.id, input.blueprintId))
      .limit(1);

    if (!bp) {
      return { validationsCreated: 0, falseProgressFlagged: false };
    }

    const daysElapsed = Math.max(
      1,
      (Date.now() - bp.created_at.getTime()) / 86400000,
    );

    const [{ completedOrders }] = await db
      .select({ completedOrders: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, input.blueprintId),
          inArray(orders.status, [OrderStatus.COMPLETED, "complete" as typeof OrderStatus.COMPLETED]),
        ),
      );

    const completedCount = completedOrders ?? 0;
    const expectedTasksPerDay = 1;
    const activityRatio = completedCount / Math.max(1, daysElapsed * expectedTasksPerDay);

    const targetRows = await db
      .select()
      .from(targets)
      .where(
        and(
          eq(targets.blueprint_id, input.blueprintId),
          inArray(targets.status, [
            TargetStatus.ACTIVE,
            TargetStatus.ON_TRACK,
            TargetStatus.AT_RISK,
          ]),
        ),
      );

    const processTargets =
      targetRows.length > 0 ? targetRows.map((t) => t.id) : [null as string | null];

    let validationsCreated = 0;
    let falseProgressFlagged = false;

    for (const targetId of processTargets) {

      const pendingOutcomes = targetId
        ? await db
            .select()
            .from(realOutcomes)
            .where(
              and(
                eq(realOutcomes.user_id, input.userId),
                eq(realOutcomes.blueprint_id, input.blueprintId),
                eq(realOutcomes.target_id, targetId),
                eq(realOutcomes.validation_status, "pending"),
              ),
            )
        : await db
            .select()
            .from(realOutcomes)
            .where(
              and(
                eq(realOutcomes.user_id, input.userId),
                eq(realOutcomes.blueprint_id, input.blueprintId),
                eq(realOutcomes.validation_status, "pending"),
              ),
            );

      const validatedOutcomes = await db
        .select()
        .from(realOutcomes)
        .where(
          and(
            eq(realOutcomes.user_id, input.userId),
            eq(realOutcomes.blueprint_id, input.blueprintId),
            eq(realOutcomes.validation_status, "validated"),
          ),
        );

      let result: Il2ValidationResult = "INSUFFICIENT_EVIDENCE";
      let evidenceScore = 0;

      if (pendingOutcomes.length > 0 && activityRatio >= 0.5) {
        result = "PASSED";
        evidenceScore = 0.8;
        for (const ro of pendingOutcomes) {
          await db
            .update(realOutcomes)
            .set({ validation_status: "validated" })
            .where(eq(realOutcomes.id, ro.id));
        }
        await resolveActiveFlagsForBlueprint(
          input.blueprintId,
          "Real outcome evidence submitted and validated",
        );
      } else if (activityRatio >= 0.7 && completedCount >= 10) {
        result = "PARTIAL";
        evidenceScore = 0.5;
      } else if (completedCount >= 5 && pendingOutcomes.length === 0 && validatedOutcomes.length === 0) {
        await this.checkFalseProgress(
          input.userId,
          input.blueprintId,
          completedCount,
          daysElapsed,
        );
        falseProgressFlagged = true;
      }

      const verdict = mapIl2ToVerdict(result);
      const summary = `${completedCount} tasks in ${Math.round(daysElapsed)}d. Real outcomes pending: ${pendingOutcomes.length}. Activity ratio: ${activityRatio.toFixed(2)}.`;

      await db.insert(outcomeValidations).values({
        blueprint_id: input.blueprintId,
        user_id: input.userId,
        target_id: targetId ?? null,
        validation_result: result,
        evidence_score: evidenceScore,
        evidence_summary: summary,
        validator_source: "SYSTEM",
        validated_at: new Date(),
        tasks_completed: completedCount,
        outcomes_verified: Math.round(evidenceScore * 100),
        alignment_score: evidenceScore * 100,
        verdict,
        notes: JSON.stringify({
          phase: input.phase,
          trigger: input.trigger ?? "outcome_validation_requested",
          activity_ratio: activityRatio,
        }),
      });

      validationsCreated++;
    }

    logger.info(
      {
        blueprintId: input.blueprintId,
        validationsCreated,
        falseProgressFlagged,
        completedCount,
      },
      "[OutcomeValidationEngine] validate complete",
    );

    return { validationsCreated, falseProgressFlagged };
  }

  private async checkFalseProgress(
    userId: string,
    blueprintId: string,
    taskCount: number,
    days: number,
  ): Promise<void> {
    if (taskCount < 15 || days < 14) return;

    const [existing] = await db
      .select({ id: falseProgressFlags.id })
      .from(falseProgressFlags)
      .where(
        and(
          eq(falseProgressFlags.user_id, userId),
          eq(falseProgressFlags.blueprint_id, blueprintId),
          eq(falseProgressFlags.resolved, false),
        ),
      )
      .limit(1);

    if (existing) return;

    await createFalseProgressFlag({
      userId,
      blueprintId,
      flagType: "ACTIVITY_WITHOUT_OUTCOME",
      correctionTaskType: "root_cause_review",
    });
  }
}

export const outcomeValidationEngine = new OutcomeValidationEngine();

export async function recordRealOutcome(input: {
  userId: string;
  blueprintId: string;
  targetId?: string;
  outcomeType: string;
  claimedValue: string;
  evidenceText: string;
  metricName?: string;
  metricValue?: number;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(realOutcomes)
    .values({
      user_id: input.userId,
      blueprint_id: input.blueprintId,
      target_id: input.targetId ?? null,
      outcome_type: input.outcomeType,
      claimed_value: input.claimedValue,
      evidence_text: input.evidenceText,
      metric_name: input.metricName ?? input.outcomeType,
      metric_value: input.metricValue ?? 1,
      validation_status: "pending",
      source: "user_submission",
    })
    .returning({ id: realOutcomes.id });

  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to record real outcome");
  return { id: row.id };
}

export async function getOpenFlagsAtOrAboveSeverity(
  blueprintId: string,
  minSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "MEDIUM",
): Promise<typeof falseProgressFlags.$inferSelect[]> {
  const all = await getOpenFlags(blueprintId);
  const minRank =
    minSeverity === "CRITICAL" ? 3 : minSeverity === "HIGH" ? 2 : minSeverity === "MEDIUM" ? 1 : 0;
  const rank = (s: string | null | undefined) => {
    const v = (s ?? "low").toLowerCase();
    if (v === "critical") return 3;
    if (v === "high") return 2;
    if (v === "medium") return 1;
    return 0;
  };
  return all.filter((f) => rank(f.severity) >= minRank);
}

/** TORGIMA P2 — gate phase/reward/advancement paths. */
export async function checkOutcomeIntegrity(
  userId: string,
  blueprintId: string,
  targetId?: string,
): Promise<{ canAdvance: boolean; blockers: string[] }> {
  const openFlags = await getOpenFlagsAtOrAboveSeverity(blueprintId, "MEDIUM");
  const flagBlockers = openFlags.map(
    (f) => `False progress detected: ${f.detection_type}`,
  );

  const validationRows = await db
    .select({
      verdict: outcomeValidations.verdict,
      targetId: outcomeValidations.target_id,
      notes: outcomeValidations.notes,
    })
    .from(outcomeValidations)
    .where(eq(outcomeValidations.blueprint_id, blueprintId))
    .orderBy(desc(outcomeValidations.validated_at))
    .limit(20);

  const badStatuses = new Set(["UNVALIDATED", "CONTRADICTED", "FALSE_PROGRESS"]);
  const unvalidated = validationRows.filter((v) => {
    if (targetId && v.targetId && v.targetId !== targetId) return false;
    return v.verdict != null && badStatuses.has(v.verdict);
  });

  const validationBlockers = unvalidated.map(
    (v) => `Outcome not validated: ${v.targetId ?? "blueprint"}`,
  );

  return {
    canAdvance: flagBlockers.length === 0 && validationBlockers.length === 0,
    blockers: [...flagBlockers, ...validationBlockers],
  };
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
