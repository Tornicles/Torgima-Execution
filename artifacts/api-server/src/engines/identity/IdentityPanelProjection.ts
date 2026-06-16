/**
 * DOC18 Task 4 — customer-facing identity panel (no internal enum names).
 */

import type { userIdentityStates } from "@workspace/db";
import {
  collectTransformationEvidence,
  type TransformationEvidence,
} from "./TransformationEvidenceCollector.js";
import {
  il1FromDbStage,
  nextStageLabel,
  stageOrder,
  type Il1IdentityStage,
} from "./stageTypes.js";
import { highestQualifiedStage } from "./IdentityStageEvaluator.js";

export const STAGE_CUSTOMER_LABELS: Record<Il1IdentityStage, string> = {
  UNFORMED: "Getting Started",
  INITIATING: "Building Momentum",
  BUILDING: "Developing Consistency",
  STABILIZING: "Finding Your Rhythm",
  EXPANDING: "Growing Your Capacity",
  INTEGRATED: "Operating at Your Best",
  REGRESSING: "Time to Refocus",
  RESTARTING: "Restarting Strong",
};

const STAGE_DESCRIPTIONS: Record<Il1IdentityStage, string> = {
  UNFORMED: "Your execution identity is just beginning to form from real work.",
  INITIATING: "You are building the habit of showing up and completing tasks.",
  BUILDING: "Repeated execution is becoming a visible pattern.",
  STABILIZING: "You are maintaining momentum even when friction appears.",
  EXPANDING: "You are handling more difficulty and proving real outcomes.",
  INTEGRATED: "Your daily execution aligns with your goal over time.",
  REGRESSING: "Recent patterns suggest it is time to simplify and refocus.",
  RESTARTING: "You are re-entering execution after drift with a recovery win.",
};

const TRANSFORMATION_MESSAGES: Record<Il1IdentityStage, string> = {
  UNFORMED: "Complete a few tasks this week to establish your baseline.",
  INITIATING: "Keep stacking small wins — consistency comes next.",
  BUILDING: "Your pattern is forming. Protect the streak you are building.",
  STABILIZING: "Friction is normal. Recovery is part of the rhythm.",
  EXPANDING: "You are proving capacity — stay honest with your proof.",
  INTEGRATED: "You are operating at your best. Sustain with integrity.",
  REGRESSING: "One clear recovery task can reset momentum.",
  RESTARTING: "Strong restart. Keep the next window simple and completable.",
};

export interface IdentityPanelView {
  stage_label: string;
  stage_description: string;
  consistency_score: number;
  days_active_this_month: number;
  milestones_completed: number;
  current_streak_days: number;
  next_stage_label: string;
  progress_to_next: number;
  transformation_message: string;
}

function progressToNext(current: Il1IdentityStage, evidence: TransformationEvidence): number {
  const next = nextStageLabel(current);
  if (!next) return 100;

  switch (next) {
    case "INITIATING":
      return Math.min(100, Math.round((evidence.accepted_feedback_count_7d / 3) * 100));
    case "BUILDING":
      return Math.min(
        100,
        Math.round(
          ((evidence.accepted_feedback_count_14d / 7) * 50 +
            evidence.consistency_14d * 50),
        ),
      );
    case "STABILIZING":
      return Math.min(
        100,
        Math.round(
          ((evidence.accepted_feedback_count_14d / 14) * 50 +
            evidence.consistency_14d * 50),
        ),
      );
    case "EXPANDING":
      return Math.min(
        100,
        Math.round(
          (evidence.capability_upgrades_proven > 0 ? 50 : 0) +
            (evidence.outcomes_validated > 0 ? 50 : 0),
        ),
      );
    case "INTEGRATED":
      return Math.min(
        100,
        Math.round(
          ((evidence.accepted_feedback_count_30d / 20) * 60 +
            (evidence.milestones_completed > 0 ? 40 : 0)),
        ),
      );
    case "RESTARTING":
      return evidence.recovery_tasks_completed >= 1 ? 100 : 50;
    default:
      return Math.min(100, Math.round(evidence.consistency_14d * 100));
  }
}

export async function buildIdentityPanelView(params: {
  userId: string;
  blueprintId: string;
  identityRow?: typeof userIdentityStates.$inferSelect | null;
}): Promise<IdentityPanelView> {
  const evidence = await collectTransformationEvidence(params.userId, params.blueprintId);
  const il1Stage = params.identityRow
    ? il1FromDbStage(params.identityRow.stage, params.identityRow.regression_risk)
    : highestQualifiedStage(evidence);

  const next = nextStageLabel(il1Stage);
  const nextLabel = next ? STAGE_CUSTOMER_LABELS[next] : STAGE_CUSTOMER_LABELS.INTEGRATED;

  return {
    stage_label: STAGE_CUSTOMER_LABELS[il1Stage],
    stage_description: STAGE_DESCRIPTIONS[il1Stage],
    consistency_score: Math.round(evidence.consistency_14d * 100),
    days_active_this_month: evidence.days_active_this_month,
    milestones_completed: evidence.milestones_completed,
    current_streak_days: evidence.current_streak_days,
    next_stage_label: nextLabel,
    progress_to_next: progressToNext(il1Stage, evidence),
    transformation_message: TRANSFORMATION_MESSAGES[il1Stage],
  };
}

/** Dashboard back-compat — customer labels only, never internal enum values. */
export function toDashboardIdentityFromPanel(panel: IdentityPanelView) {
  return {
    stage: panel.stage_label,
    stageLabel: panel.stage_label,
    stageDescription: panel.stage_description,
    stabilityScore: panel.consistency_score,
    continuityScore: panel.consistency_score,
    transformationScore: panel.progress_to_next,
    regressionRisk: panel.stage_label === STAGE_CUSTOMER_LABELS.REGRESSING ? ("HIGH" as const) : ("LOW" as const),
    nextStageLabel: panel.next_stage_label,
    progressToNext: panel.progress_to_next,
    transformationMessage: panel.transformation_message,
    currentStreakDays: panel.current_streak_days,
    daysActiveThisMonth: panel.days_active_this_month,
    milestonesCompleted: panel.milestones_completed,
  };
}

export function customerLabelForStage(stage: Il1IdentityStage): string {
  return STAGE_CUSTOMER_LABELS[stage];
}

export function isCustomerFacingLabel(label: string): boolean {
  return Object.values(STAGE_CUSTOMER_LABELS).includes(label);
}

export function stageProgressIndex(stage: Il1IdentityStage): number {
  return stageOrder(stage);
}
