/**
 * DOC25 — FrictionDetectionEngine orchestration, evidence loading, and adaptation routing.
 */

import {
  db,
  feedback,
  behaviorPatterns,
  cognitiveLoadScores,
  behaviorEvents,
} from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { routeAdaptation } from "./AdaptationRouter.js";
import { FrictionClassifier } from "./FrictionClassifier.js";
import { loadFrictionEvidence } from "./FrictionEvidence.js";
import {
  DOC25_FRICTION_TYPES,
  FRICTION_TYPES,
  LEGACY_FRICTION_TYPES,
  SEVERITY_ORDER,
  type Doc25FrictionType,
  type FrictionContext,
  type FrictionDetectionResult,
  type FrictionSeverity,
  type FrictionType,
} from "./frictionTypes.js";

export {
  DOC25_FRICTION_TYPES,
  FRICTION_TYPES,
  LEGACY_FRICTION_TYPES,
  SEVERITY_ORDER,
  type Doc25FrictionType,
  type FrictionType,
  type FrictionContext,
  type FrictionDetectionResult,
  type FrictionSeverity,
};

export { FrictionClassifier } from "./FrictionClassifier.js";
export {
  ADAPTATION_MATRIX,
  ADAPTATION_CYCLE_LIMIT,
  routeAdaptation,
  resolveAdaptationEvent,
  shouldTriggerRootCauseReview,
  adaptationIncreasesDifficulty,
  isUserCorrectionTaskEvent,
} from "./AdaptationRouter.js";
export { loadFrictionEvidence, buildFrictionEvidenceFromParts, type FrictionEvidence } from "./FrictionEvidence.js";

function blockerKeys(nonNull: unknown): number {
  if (nonNull && typeof nonNull === "object" && !Array.isArray(nonNull)) {
    return Object.keys(nonNull as Record<string, unknown>).length;
  }
  return 0;
}

async function writeFrictionBehaviorEvents(params: {
  userId: string;
  blueprintId: string;
  feedbackId?: string;
  detected: Array<{ type: Doc25FrictionType; severity: FrictionSeverity; reason: string }>;
}): Promise<void> {
  for (const friction of params.detected) {
    await db
      .insert(behaviorEvents)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId,
        feedback_id: params.feedbackId,
        event_type: "FRICTION_SPIKE",
        data_json: {
          friction_type: friction.type,
          severity: friction.severity,
          reason: friction.reason,
          spec_label: friction.type,
        },
      })
      .catch(() => null);
  }
}

async function checkRepeatedFriction(
  userId: string,
  blueprintId: string,
  frictionType: Doc25FrictionType,
): Promise<boolean> {
  const since = new Date(Date.now() - 7 * 86400000);
  const rows = await db
    .select({ data_json: behaviorEvents.data_json })
    .from(behaviorEvents)
    .where(
      and(
        eq(behaviorEvents.user_id, userId),
        eq(behaviorEvents.blueprint_id, blueprintId),
        gte(behaviorEvents.detected_at, since),
      ),
    )
    .limit(50);

  const count = rows.filter((row) => {
    const data = row.data_json as { friction_type?: string };
    return data.friction_type === frictionType;
  }).length;

  return count >= 2;
}

async function recordAdaptationApplied(params: {
  userId: string;
  blueprintId: string;
  feedbackId?: string;
  frictionType: Doc25FrictionType;
  adaptationEvent: string;
}): Promise<void> {
  await db
    .insert(behaviorEvents)
    .values({
      user_id: params.userId,
      blueprint_id: params.blueprintId,
      feedback_id: params.feedbackId,
      event_type: "friction_adaptation_applied",
      data_json: {
        friction_type: params.frictionType,
        adaptation_event: params.adaptationEvent,
      },
    })
    .catch(() => null);
}

/** DOC25 Task 3 — primary friction detection and adaptation flow. */
export async function runFrictionDetection(
  context: FrictionContext,
): Promise<FrictionDetectionResult | null> {
  const evidence = await loadFrictionEvidence(context);
  if (!evidence) return null;

  const detected = FrictionClassifier.classify(evidence);
  if (detected.length === 0) {
    return { detected: [], primary: null, adaptationRouted: false };
  }

  const primary = FrictionClassifier.selectPrimary(detected);
  if (!primary) {
    return { detected, primary: null, adaptationRouted: false };
  }

  await writeFrictionBehaviorEvents({
    userId: context.userId,
    blueprintId: context.blueprintId,
    feedbackId: context.feedbackId,
    detected,
  });

  const repeated = await checkRepeatedFriction(
    context.userId,
    context.blueprintId,
    primary.type,
  );
  if (repeated) {
    await writeEvent({
      eventType: EVENT_TYPES.PATTERN_SCAN_REQUESTED,
      entityType: "blueprint",
      entityId: context.blueprintId,
      userId: context.userId,
      blueprintId: context.blueprintId,
      payload: { reason: `repeated_${primary.type}`, friction_type: primary.type },
      idempotencyKey: `pattern_scan:friction:${context.blueprintId}:${primary.type}`,
    }).catch(() => null);
  }

  const route = await routeAdaptation({
    frictionType: primary.type,
    severity: primary.severity,
    context,
    adaptationCycleCount: evidence.adaptationCycleCount,
    reason: primary.reason,
  });

  if (route.routed) {
    await recordAdaptationApplied({
      userId: context.userId,
      blueprintId: context.blueprintId,
      feedbackId: context.feedbackId,
      frictionType: primary.type,
      adaptationEvent: route.adaptationEvent,
    });
  }

  logger.info(
    {
      blueprintId: context.blueprintId,
      feedbackId: context.feedbackId,
      primary: primary.type,
      severity: primary.severity,
      adaptationEvent: route.adaptationEvent,
    },
    "[FrictionDetectionEngine] Friction detected and routed",
  );

  return {
    detected,
    primary,
    adaptationRouted: route.routed,
    adaptationEvent: route.adaptationEvent,
    rootCauseReview: route.rootCauseReview,
  };
}

/** Feedback hook — runs DOC25 flow plus 14-day friction map for generation. */
export async function detectFrictionForFeedback(params: {
  userId: string;
  blueprintId: string;
  feedbackId: string;
}): Promise<{ frictions: FrictionType[]; adaptationRequested: boolean }> {
  const [fb] = await db
    .select({ order_id: feedback.order_id })
    .from(feedback)
    .where(eq(feedback.id, params.feedbackId))
    .limit(1);

  const result = await runFrictionDetection({
    userId: params.userId,
    blueprintId: params.blueprintId,
    feedbackId: params.feedbackId,
    orderId: fb?.order_id ?? undefined,
    trigger: "feedback",
  });

  const { buildFrictionMap, emitStrongFrictionAdaptations } = await import(
    "./frictionWindowScoring.js"
  );
  const frictionMap = await buildFrictionMap({
    userId: params.userId,
    blueprintId: params.blueprintId,
  });
  await emitStrongFrictionAdaptations({
    userId: params.userId,
    blueprintId: params.blueprintId,
    frictionMap,
  });

  const frictions = (result?.detected.map((d) => d.type) ?? []) as FrictionType[];
  return {
    frictions,
    adaptationRequested: Boolean(result?.adaptationRouted),
  };
}

/** Phase 5 — friction map for TaskGenerationEngine (reduces, never eliminates). */
export async function getFrictionMapForGeneration(params: {
  userId: string;
  blueprintId: string;
}): Promise<import("./frictionWindowScoring.js").FrictionMap> {
  const { buildFrictionMap } = await import("./frictionWindowScoring.js");
  return buildFrictionMap(params);
}

/** Window-level friction summary for dashboard/API. */
export async function detectFriction(params: {
  userId: string;
  blueprintId: string;
}): Promise<{ frictionType: string | null; severity: string; adaptationNeeded: boolean }> {
  const since = new Date(Date.now() - 7 * 86400000);

  const [spikeRows, feedbackRows, patterns, cogRow] = await Promise.all([
    db
      .select({ data_json: behaviorEvents.data_json })
      .from(behaviorEvents)
      .where(
        and(
          eq(behaviorEvents.user_id, params.userId),
          eq(behaviorEvents.blueprint_id, params.blueprintId),
          eq(behaviorEvents.event_type, "FRICTION_SPIKE"),
          gte(behaviorEvents.detected_at, since),
        ),
      )
      .orderBy(desc(behaviorEvents.detected_at))
      .limit(10),
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

  if (spikeRows.length > 0) {
    const latest = spikeRows[0]!.data_json as {
      friction_type?: string;
      severity?: FrictionSeverity;
    };
    const severity = latest.severity ?? "MEDIUM";
    return {
      frictionType: latest.friction_type ?? null,
      severity,
      adaptationNeeded: SEVERITY_ORDER[severity] >= SEVERITY_ORDER.MEDIUM,
    };
  }

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
    frictionType = "TIMING_FRICTION";
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

export {
  buildFrictionMap,
  highFrictionTaskTypes,
  computeFrictionScore,
} from "./frictionWindowScoring.js";
