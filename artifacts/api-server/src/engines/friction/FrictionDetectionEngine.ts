import { db, feedback, behaviorPatterns, cognitiveLoadScores } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";

function blockerKeys(nonNull: unknown): number {
  if (nonNull && typeof nonNull === "object" && !Array.isArray(nonNull)) {
    return Object.keys(nonNull as Record<string, unknown>).length;
  }
  return 0;
}

export async function detectFriction(params: {
  userId:      string;
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
    feedbackRows.filter(f => f.completion_status === "failed").length / feedbackRows.length;
  const blockerRate =
    feedbackRows.filter(f => blockerKeys(f.blocker_json) > 0).length / feedbackRows.length;
  const hasDifficultyFailure = patterns.some(
    p =>
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
      eventType:      EVENT_TYPES.FRICTION_ADAPTATION_REQUESTED,
      entityType:     "blueprint",
      entityId:       params.blueprintId,
      userId:         params.userId,
      blueprintId:    params.blueprintId,
      payload:        { friction_type: frictionType, severity, adaptation: "simplify_tasks" },
      idempotencyKey: `friction:${params.blueprintId}:${frictionType}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(err => logger.warn({ err }, "[FrictionEngine] event write failed"));
  }

  return { frictionType, severity, adaptationNeeded };
}
