/**
 * DOC18 Task 2 — stage evaluation, advancement, regression, and persistence.
 */

import { db, userIdentityStates, identityHistory } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { DecisionTraceService } from "../decision/DecisionTraceService.js";
import { getBlueprintStateVersion } from "../decision-trace/DecisionTraceSystem.js";
import { calculateIdentityDimensions } from "./identityDimensions.js";
import {
  collectTransformationEvidence,
  type TransformationEvidence,
} from "./TransformationEvidenceCollector.js";
import {
  IL1_TO_DB_STAGE,
  STAGE_ADVANCEMENT_ORDER,
  il1FromDbStage,
  stageOrder,
  type DbIdentityStage,
  type Il1IdentityStage,
} from "./stageTypes.js";

export interface IdentityEvaluationResult {
  evaluated: boolean;
  advanced: boolean;
  held?: boolean;
  hold_reason?: string;
  currentStage: Il1IdentityStage;
  previousStage?: Il1IdentityStage;
  dbStage: DbIdentityStage;
  regressionRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function calculateRegressionRisk(consistency: number): IdentityEvaluationResult["regressionRisk"] {
  if (consistency < 0.2) return "CRITICAL";
  if (consistency < 0.4) return "HIGH";
  if (consistency < 0.6) return "MEDIUM";
  return "LOW";
}

/** Back-compat helper used by IL1 unit tests. */
export function calculateStage(
  consistency: number,
  avgScore: number,
  count: number,
  current?: string | null,
): Il1IdentityStage {
  if (count < 3) return "INITIATING";
  if (consistency < 0.3) return "REGRESSING";
  if (consistency >= 0.8 && avgScore >= 7 && count >= 20) return "INTEGRATED";
  if (consistency >= 0.75 && avgScore >= 6.5) return "EXPANDING";
  if (consistency >= 0.65 && avgScore >= 6) return "STABILIZING";
  if (consistency >= 0.5 && count >= 7) return "BUILDING";
  if (current) return il1FromDbStage(current);
  return "INITIATING";
}

function meetsInitiating(evidence: TransformationEvidence): boolean {
  return evidence.accepted_feedback_count_7d >= 3;
}

function meetsBuilding(evidence: TransformationEvidence): boolean {
  return (
    evidence.accepted_feedback_count_14d >= 7 && evidence.consistency_14d >= 0.5
  );
}

function meetsStabilizing(evidence: TransformationEvidence): boolean {
  return (
    evidence.accepted_feedback_count_14d >= 14 &&
    evidence.consistency_14d > 0.65 &&
    evidence.recovery_tasks_completed >= 1
  );
}

function meetsExpanding(evidence: TransformationEvidence): boolean {
  return (
    evidence.capability_upgrades_proven >= 1 &&
    evidence.current_difficulty_level >= 3 &&
    evidence.outcomes_validated >= 1
  );
}

function meetsIntegrated(evidence: TransformationEvidence): boolean {
  return (
    evidence.accepted_feedback_count_30d >= 20 &&
    evidence.consistency_14d > 0.7 &&
    evidence.milestones_completed >= 1 &&
    evidence.outcomes_validated >= 1 &&
    evidence.days_since_last_activity <= 7
  );
}

export function highestQualifiedStage(evidence: TransformationEvidence): Il1IdentityStage {
  if (meetsIntegrated(evidence)) return "INTEGRATED";
  if (meetsExpanding(evidence)) return "EXPANDING";
  if (meetsStabilizing(evidence)) return "STABILIZING";
  if (meetsBuilding(evidence)) return "BUILDING";
  if (meetsInitiating(evidence)) return "INITIATING";
  return "UNFORMED";
}

export function determineNextStage(
  currentStage: Il1IdentityStage,
  evidence: TransformationEvidence,
): Il1IdentityStage | null {
  const target = highestQualifiedStage(evidence);
  if (stageOrder(target) > stageOrder(currentStage)) return target;
  return null;
}

async function loadCurrentIdentityState(userId: string, blueprintId: string) {
  const [row] = await db
    .select()
    .from(userIdentityStates)
    .where(
      and(
        eq(userIdentityStates.user_id, userId),
        eq(userIdentityStates.blueprint_id, blueprintId),
        eq(userIdentityStates.is_current, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function advanceToStage(
  userId: string,
  blueprintId: string,
  nextStage: Il1IdentityStage,
  currentState: Awaited<ReturnType<typeof loadCurrentIdentityState>>,
  evidence: TransformationEvidence,
  trigger: string,
  sourceFeedbackId?: string,
): Promise<IdentityEvaluationResult> {
  const previousDbStage = (currentState?.stage ?? "starting") as DbIdentityStage;
  const previousStage = il1FromDbStage(previousDbStage, currentState?.regression_risk);
  const dbStage = IL1_TO_DB_STAGE[nextStage];
  const regressionRisk = calculateRegressionRisk(evidence.consistency_14d);
  const dimensions = calculateIdentityDimensions({
    evidence: [],
    inactivityGapHours: evidence.days_since_last_activity * 24,
    avgOrderDifficulty: evidence.current_difficulty_level,
  });
  const changed = previousDbStage !== dbStage;

  await db.transaction(async (tx) => {
    if (currentState) {
      await tx
        .update(userIdentityStates)
        .set({ is_current: false })
        .where(eq(userIdentityStates.id, currentState.id));
    }

    await tx.insert(userIdentityStates).values({
      user_id: userId,
      blueprint_id: blueprintId,
      stage: dbStage,
      previous_stage: previousDbStage,
      stability_score: Math.round(evidence.consistency_14d * 100),
      continuity_score: dimensions.focusContinuity,
      transformation_score: Math.round(
        (dimensions.completionIntegrity + dimensions.difficultyTolerance) / 2,
      ),
      regression_risk: regressionRisk,
      evidence_count: evidence.accepted_feedback_count_14d,
      last_evidence_at: new Date(),
      last_reinforced_at: new Date(),
      reinforcement_count: (currentState?.reinforcement_count ?? 0) + 1,
      is_current: true,
    });

    if (changed) {
      await tx.insert(identityHistory).values({
        user_id: userId,
        blueprint_id: blueprintId,
        trigger,
        stage_before: previousDbStage,
        stage_after: dbStage,
        transformation_score: Math.round(evidence.consistency_14d * 100),
        snapshot: {
          il1_stage: nextStage,
          regression_risk: regressionRisk,
          evidence_summary: evidence,
          source_feedback_id: sourceFeedbackId ?? null,
        },
      });
    }
  });

  if (changed) {
    await writeEvent({
      eventType: EVENT_TYPES.IDENTITY_UPDATED,
      entityType: "identity",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: {
        stage: nextStage,
        db_stage: dbStage,
        previous_stage: previousDbStage,
        identity_stage_advanced: true,
      },
      idempotencyKey: `identity_updated:${blueprintId}:${dbStage}:${Date.now()}`,
    }).catch(() => null);
  }

  if (nextStage === "REGRESSING" || regressionRisk === "HIGH" || regressionRisk === "CRITICAL") {
    await writeEvent({
      eventType: EVENT_TYPES.IDENTITY_REGRESSION_DETECTED,
      entityType: "identity",
      entityId: blueprintId,
      userId,
      blueprintId,
      payload: { stage: nextStage, regression_risk: regressionRisk },
      idempotencyKey: `identity_regression:${blueprintId}:${trigger}`,
    }).catch(() => null);
  }

  const stateVersion = await getBlueprintStateVersion(blueprintId).catch(() => 0);
  await DecisionTraceService.write({
    userId,
    blueprintId,
    decisionType: "SYSTEM_CONTROL",
    decisionKey: `identity_stage:${blueprintId}`,
    selectedOption: changed ? nextStage : `HOLD:${nextStage}`,
    optionsConsidered: [previousStage, nextStage],
    rationaleSummary: changed
      ? `Identity advanced ${previousStage} → ${nextStage}`
      : `Identity held at ${nextStage}`,
    sourceEngine: "IdentityStageEvaluator",
    confidence: regressionRisk === "LOW" ? "HIGH" : "MEDIUM",
    stateVersion,
    causationEventId: sourceFeedbackId,
  }).catch(() => null);

  return {
    evaluated: true,
    advanced: changed,
    currentStage: nextStage,
    previousStage,
    dbStage,
    regressionRisk,
  };
}

export async function evaluateIdentityStage(
  userId: string,
  blueprintId: string,
  options?: { trigger?: string; sourceFeedbackId?: string },
): Promise<IdentityEvaluationResult> {
  const currentState = await loadCurrentIdentityState(userId, blueprintId);
  const currentStage = currentState
    ? il1FromDbStage(currentState.stage, currentState.regression_risk)
    : "UNFORMED";
  const evidence = await collectTransformationEvidence(userId, blueprintId);
  const trigger = options?.trigger ?? "scheduled_evaluation";

  const regressionTriggered =
    evidence.missed_windows_last_7_days >= 3 || evidence.critical_false_progress_open;

  if (regressionTriggered && !["REGRESSING", "UNFORMED"].includes(currentStage)) {
    return advanceToStage(
      userId,
      blueprintId,
      "REGRESSING",
      currentState,
      evidence,
      trigger,
      options?.sourceFeedbackId,
    );
  }

  if (currentStage === "REGRESSING" && evidence.recovery_tasks_completed >= 1) {
    return advanceToStage(
      userId,
      blueprintId,
      "RESTARTING",
      currentState,
      evidence,
      trigger,
      options?.sourceFeedbackId,
    );
  }

  const nextStage = determineNextStage(currentStage, evidence);
  if (nextStage && nextStage !== currentStage) {
    const blocked =
      (nextStage === "BUILDING" && evidence.critical_false_progress_open) ||
      (["STABILIZING", "EXPANDING", "INTEGRATED"].includes(nextStage) &&
        evidence.any_false_progress_open);

    if (blocked) {
      await writeEvent({
        eventType: EVENT_TYPES.IDENTITY_ADVANCEMENT_BLOCKED,
        entityType: "identity",
        entityId: blueprintId,
        userId,
        blueprintId,
        payload: {
          attempted_stage: nextStage,
          hold_reason: "false_progress_flag_open",
          identity_stage_held: true,
        },
        idempotencyKey: `identity_held:${blueprintId}:${nextStage}`,
      }).catch(() => null);

      await DecisionTraceService.write({
        userId,
        blueprintId,
        decisionType: "SYSTEM_CONTROL",
        decisionKey: `identity_hold:${blueprintId}`,
        selectedOption: "HOLD",
        optionsConsidered: [currentStage, nextStage],
        rejectedOptions: [nextStage],
        rationaleSummary: "Identity advancement blocked by open false progress flag",
        sourceEngine: "IdentityStageEvaluator",
        confidence: "HIGH",
        stateVersion: await getBlueprintStateVersion(blueprintId).catch(() => 0),
      }).catch(() => null);

      if (evidence.any_false_progress_open) {
        await writeEvent({
          eventType: EVENT_TYPES.IDENTITY_REVIEW_REQUIRED,
          entityType: "identity",
          entityId: blueprintId,
          userId,
          blueprintId,
          payload: { reason: "false_progress_flag_open", stage: currentStage },
          idempotencyKey: `identity_review:${blueprintId}:false_progress`,
        }).catch(() => null);
      }

      return {
        evaluated: true,
        advanced: false,
        held: true,
        hold_reason: "false_progress_flag_open",
        currentStage,
        dbStage: IL1_TO_DB_STAGE[currentStage],
        regressionRisk: calculateRegressionRisk(evidence.consistency_14d),
      };
    }

    return advanceToStage(
      userId,
      blueprintId,
      nextStage,
      currentState,
      evidence,
      trigger,
      options?.sourceFeedbackId,
    );
  }

  logger.info(
    { userId, blueprintId, currentStage, evidenceCount: evidence.accepted_feedback_count_14d },
    "[IdentityStageEvaluator] No stage change",
  );

  return {
    evaluated: true,
    advanced: false,
    currentStage,
    dbStage: IL1_TO_DB_STAGE[currentStage],
    regressionRisk: calculateRegressionRisk(evidence.consistency_14d),
  };
}

export function nextStageLabel(current: Il1IdentityStage): Il1IdentityStage | null {
  if (current === "REGRESSING") return "RESTARTING";
  if (current === "RESTARTING") return "INITIATING";
  const idx = STAGE_ADVANCEMENT_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ADVANCEMENT_ORDER.length - 1) return null;
  return STAGE_ADVANCEMENT_ORDER[idx + 1] ?? null;
}
