/**
 * Phase 3 DOC 18 — six identity dimensions (0–100).
 */

import type { feedback } from "@workspace/db";

type FeedbackRow = typeof feedback.$inferSelect;

export interface IdentityDimensionScores {
  consistency: number;
  completionIntegrity: number;
  difficultyTolerance: number;
  recoveryAbility: number;
  focusContinuity: number;
  frictionResponse: number;
}

export function calculateIdentityDimensions(params: {
  evidence: FeedbackRow[];
  inactivityGapHours?: number;
  avgOrderDifficulty?: number;
}): IdentityDimensionScores {
  const { evidence, inactivityGapHours = 0, avgOrderDifficulty = 3 } = params;
  const n = evidence.length;

  if (n === 0) {
    return {
      consistency: 0,
      completionIntegrity: 0,
      difficultyTolerance: 0,
      recoveryAbility: 50,
      focusContinuity: 0,
      frictionResponse: 50,
    };
  }

  const completed = evidence.filter((f) => f.completion_status === "completed").length;
  const accepted = evidence.filter((f) => f.validity === "valid" && !f.gaming_flag).length;
  const failed = evidence.filter((f) => f.completion_status === "failed").length;
  const blocked = evidence.filter((f) => f.completion_status === "blocked").length;
  const withReflection = evidence.filter(
    (f) => (f.reflection ?? "").trim().length >= 10,
  ).length;

  const consistency =
    inactivityGapHours > 72 ? 20 : inactivityGapHours > 48 ? 45 : n >= 5 ? 75 : n * 12;

  const completionIntegrity = n > 0 ? Math.round((accepted / n) * 100) : 0;

  const difficultyTolerance = Math.min(
    100,
    Math.round((avgOrderDifficulty / 5) * 60 + (completed / Math.max(1, n)) * 40),
  );

  const recoveryAbility =
    failed + blocked > 0 && withReflection > 0
      ? Math.min(100, 40 + withReflection * 10)
      : failed === 0
        ? 70
        : 35;

  const focusContinuity = Math.min(100, Math.round((completed / Math.max(1, n)) * 100));

  const avgFriction =
    evidence.reduce((s, f) => s + (f.friction_score ?? 3), 0) / Math.max(1, n);
  const frictionResponse = Math.min(
    100,
    Math.round(100 - Math.max(0, avgFriction - 2) * 15 + (withReflection / n) * 20),
  );

  return {
    consistency,
    completionIntegrity,
    difficultyTolerance,
    recoveryAbility,
    focusContinuity,
    frictionResponse,
  };
}
