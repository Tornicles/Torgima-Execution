import {
  db,
  feedback,
  orders,
  behaviorPatterns,
  cognitiveLoadScores,
  behaviorEvents,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

export const FRICTION_TYPES = [
  "TIME_FRICTION",
  "DIFFICULTY_FRICTION",
  "CLARITY_FRICTION",
  "MOTIVATION_FRICTION",
  "DEPENDENCY_FRICTION",
  "COGNITIVE_FRICTION",
] as const;

export type FrictionType = (typeof FRICTION_TYPES)[number];

function blockerKeys(nonNull: unknown): number {
  if (nonNull && typeof nonNull === "object" && !Array.isArray(nonNull)) {
    return Object.keys(nonNull as Record<string, unknown>).length;
  }
  return 0;
}

function readBlockerField(
  blocker: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const v = blocker?.[key];
  return typeof v === "string" ? v : undefined;
}

/** IL4 — per-feedback friction signals (never blocks generation). */
export async function detectFrictionForFeedback(params: {
  userId: string;
  blueprintId: string;
  feedbackId: string;
}): Promise<{ frictions: FrictionType[]; adaptationRequested: boolean }> {
  const [fb] = await db
    .select()
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  if (!fb) return { frictions: [], adaptationRequested: false };

  const [order] = fb.order_id
    ? await db
        .select({
          time_estimate_minutes: orders.time_estimate_minutes,
          difficulty: orders.difficulty,
        })
        .from(orders)
        .where(eq(orders.id, fb.order_id))
        .limit(1)
    : [undefined];

  const blocker = (fb.blocker_json ?? {}) as Record<string, unknown>;
  const hadBlocker = blockerKeys(blocker) > 0;
  const blockerType = readBlockerField(blocker, "blocker_type");

  const frictions: FrictionType[] = [];

  const submittedHours =
    fb.submitted_hours_after_completion ??
    (fb.duration_minutes && order?.time_estimate_minutes
      ? Math.max(0, (fb.duration_minutes - order.time_estimate_minutes) / 60)
      : null);

  if (submittedHours != null && submittedHours > 4) {
    frictions.push("TIME_FRICTION");
  } else if (
    fb.duration_minutes != null &&
    order?.time_estimate_minutes &&
    fb.duration_minutes > order.time_estimate_minutes * 2
  ) {
    frictions.push("TIME_FRICTION");
  }

  const difficultyFelt =
    fb.difficulty_felt ??
    readBlockerField(blocker, "difficulty_felt") ??
    (fb.friction_score != null && fb.friction_score >= 4 ? "very_hard" : undefined);

  if (difficultyFelt === "very_hard") {
    frictions.push("DIFFICULTY_FRICTION");
  }

  if (hadBlocker && blockerType === "unclear_instruction") {
    frictions.push("CLARITY_FRICTION");
  }

  if (fb.completion_status === "skipped" && !hadBlocker) {
    frictions.push("MOTIVATION_FRICTION");
  }

  if (hadBlocker && blockerType && blockerType !== "unclear_instruction") {
    frictions.push("DEPENDENCY_FRICTION");
  }

  for (const frictionType of frictions) {
    await db.insert(behaviorEvents).values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      feedback_id: params.feedbackId,
      event_type: "friction_detected",
      data_json: { friction_type: frictionType, spec_label: frictionType },
    });
  }

  const adaptationRequested = frictions.length >= 2;
  if (adaptationRequested) {
    await writeEvent({
      eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
      entityType: "feedback",
      entityId: params.feedbackId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { frictions, severity: "MEDIUM", reason: "multi_signal_friction" },
      idempotencyKey: `friction_adapt:${params.feedbackId}`,
    });
  }

  if (frictions.length > 0) {
    logger.info(
      { feedbackId: params.feedbackId, frictions, adaptationRequested },
      "[FrictionDetectionEngine] Feedback friction scan",
    );
  }

  return { frictions, adaptationRequested };
}

/** Window-level friction (aggregate) — retained for dashboard scans. */
export async function detectFriction(params: {
  userId: string;
  blueprintId: string;
}): Promise<{ frictionType: string | null; severity: string; adaptationNeeded: boolean }> {
  const since = new Date(Date.now() - 7 * 86400000);

  const [feedbackRows, patterns, cogRow] = await Promise.all([
    db
      .select()
      .from(feedback)
      .where(
        and(
          eq(feedback.user_id, params.userId),
          eq(feedback.blueprint_id, params.blueprintId),
          gte(feedback.created_at, since),
        ),
      )
      .orderBy(desc(feedback.created_at))
      .limit(15),
    db
      .select()
      .from(behaviorPatterns)
      .where(
        and(
          eq(behaviorPatterns.user_id, params.userId),
          eq(behaviorPatterns.blueprint_id, params.blueprintId),
          eq(behaviorPatterns.status, "active"),
        ),
      ),
    db
      .select()
      .from(cognitiveLoadScores)
      .where(
        and(
          eq(cognitiveLoadScores.user_id, params.userId),
          eq(cognitiveLoadScores.blueprint_id, params.blueprintId),
        ),
      )
      .orderBy(desc(cognitiveLoadScores.created_at))
      .limit(1),
  ]);

  if (feedbackRows.length === 0) {
    return { frictionType: null, severity: "LOW", adaptationNeeded: false };
  }

  const avgFriction =
    feedbackRows.reduce((s, f) => s + (f.friction_score ?? 0), 0) / feedbackRows.length;
  const failureRate =
    feedbackRows.filter((f) => f.completion_status === "failed").length / feedbackRows.length;
  const blockerRate =
    feedbackRows.filter((f) => blockerKeys(f.blocker_json) > 0).length / feedbackRows.length;
  const hasDifficultyFailure = patterns.some(
    (p) =>
      p.pattern_type === "blocker_repetition" &&
      (p.evidence_json as { spec_label?: string })?.spec_label === "DIFFICULTY_FAILURE",
  );
  const hasHighCogLoad = (cogRow[0]?.load_score ?? 0) >= 0.6;

  let frictionType: string | null = null;
  let frictionScore = 0;

  if (blockerRate >= 0.3) {
    frictionType = "DEPENDENCY_FRICTION";
    frictionScore = blockerRate * 10;
  } else if (hasDifficultyFailure) {
    frictionType = "DIFFICULTY_FRICTION";
    frictionScore = failureRate * 10;
  } else if (hasHighCogLoad) {
    frictionType = "COGNITIVE_FRICTION";
    frictionScore = (cogRow[0]?.load_score ?? 0) * 10;
  } else if (avgFriction >= 3) {
    frictionType = "TIME_FRICTION";
    frictionScore = avgFriction * 2;
  }

  const severity =
    frictionScore >= 7 ? "HIGH" : frictionScore >= 4 ? "MEDIUM" : "LOW";
  const adaptationNeeded = severity !== "LOW";

  if (adaptationNeeded && frictionType) {
    await writeEvent({
      eventType: EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
      entityType: "blueprint",
      entityId: params.blueprintId,
      userId: params.userId,
      blueprintId: params.blueprintId,
      payload: { friction_type: frictionType, severity, adaptation: "simplify_tasks" },
      idempotencyKey: `friction:${params.blueprintId}:${frictionType}:${Math.floor(Date.now() / 3600000)}`,
    }).catch((err) => logger.warn({ err }, "[FrictionEngine] event write failed"));
  }

  return { frictionType, severity, adaptationNeeded };
}

export class FrictionDetectionEngine {
  async detect(input: {
    userId: string;
    blueprintId: string;
    feedbackId: string;
  }): Promise<{ frictions: FrictionType[]; adaptationRequested: boolean }> {
    return detectFrictionForFeedback(input);
  }
}

export const frictionDetectionEngine = new FrictionDetectionEngine();
