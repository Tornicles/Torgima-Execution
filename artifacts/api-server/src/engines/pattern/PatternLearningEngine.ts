import {
  db,
  feedback,
  orders,
  behaviorPatterns,
  behaviorEvents,
  capabilityProfiles,
  inactivityRecords,
  blueprints,
  enforcementPackages,
  systemHealthLogs,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { BlueprintStatus } from "@workspace/state-machine";
import { logger } from "../../lib/logger.js";
import { writeEvent, EVENT_TYPES } from "../../services/EventService.js";
import { DecisionTraceService } from "../decision/DecisionTraceService.js";
import { getBlueprintStateVersion } from "../decision-trace/DecisionTraceSystem.js";
import { getOpenFlags } from "../outcome/OutcomeValidationEngine.js";
import { calculatePatternScores } from "./patternScoring.js";
import { emitPatternResponseEvent } from "./patternResponseEvents.js";
import {
  joinFeedbackWithOrders,
  normalizeBehaviorEvidence,
  type RawFeedbackRow,
} from "./BehaviorEvidenceNormalizer.js";
import { scoreBurnoutRisk, type BurnoutRiskAssessment } from "./BurnoutRiskScorer.js";
import { detectPatternsFromEvidence } from "./PatternDetector.js";
import { evaluatePatternResolutions } from "./PatternResolver.js";

/** DOC_21 — full pattern spec labels (stored in evidence_json.spec_label). */
export const PATTERN_SPEC_LABELS = [
  "CONSISTENT_EXECUTION",
  "DELAY_PATTERN",
  "DIFFICULTY_FAILURE",
  "TASK_TYPE_AVOIDANCE",
  "LOW_VALUE_COMPLETION",
  "RECOVERY_SUCCESS",
  "ABANDONMENT_RISK",
  "FATIGUE_RISK",
  "VOLATILE_EXECUTION",
  "DIFFICULTY_CEILING",
  "RECOVERY_DEPENDENCE",
  "FALSE_PROGRESS_PATTERN",
  "FOCUS_DRIFT",
  "BURNOUT_RISK",
] as const;

export type PatternSpecLabel = (typeof PATTERN_SPEC_LABELS)[number];

/** IL3 LAW 3 — minimum occurrences within the evidence window. */
export const PATTERN_MIN_OCCURRENCES = 3;

export const DOC21_PATTERN_TYPES = [
  "procrastination",
  "inconsistency",
  "avoidance",
  "fake_completion",
  "difficulty_ceiling",
  "task_type_avoidance",
  "burnout",
  "recovery_dependence",
  "false_progress",
  "focus_drift",
] as const;

type DbPatternType =
  | "procrastination"
  | "burnout"
  | "inconsistency"
  | "avoidance"
  | "fake_completion"
  | "low_reflection"
  | "blocker_repetition"
  | "inactivity"
  | "score_inflation"
  | "difficulty_ceiling"
  | "task_type_avoidance"
  | "recovery_dependence"
  | "false_progress"
  | "focus_drift";

function mapSpecLabelToDbType(label: PatternSpecLabel): DbPatternType {
  const m: Record<PatternSpecLabel, DbPatternType> = {
    CONSISTENT_EXECUTION: "score_inflation",
    DELAY_PATTERN: "procrastination",
    DIFFICULTY_FAILURE: "blocker_repetition",
    TASK_TYPE_AVOIDANCE: "task_type_avoidance",
    LOW_VALUE_COMPLETION: "fake_completion",
    RECOVERY_SUCCESS: "inconsistency",
    ABANDONMENT_RISK: "inactivity",
    FATIGUE_RISK: "burnout",
    VOLATILE_EXECUTION: "inconsistency",
    DIFFICULTY_CEILING: "difficulty_ceiling",
    RECOVERY_DEPENDENCE: "recovery_dependence",
    FALSE_PROGRESS_PATTERN: "false_progress",
    FOCUS_DRIFT: "focus_drift",
    BURNOUT_RISK: "burnout",
  };
  return m[label];
}

const FATIGUE_RISK_SCORE: Record<string, number> = {
  low: 0.2,
  moderate: 0.5,
  high: 0.75,
  critical: 0.9,
};

export function meetsPatternThreshold(count: number, min = PATTERN_MIN_OCCURRENCES): boolean {
  return count >= min;
}

/** IL3 — burnout signal count from execution window (read-only intelligence). */
export function countBurnoutSignals(input: {
  failureRate: number;
  inactivityCount: number;
  lateCount: number;
  fatigueRiskScore: number;
}): number {
  return [
    input.failureRate >= 0.5,
    input.inactivityCount >= 3,
    input.lateCount >= 4,
    input.fatigueRiskScore >= 0.7,
  ].filter(Boolean).length;
}

function mapSeverityToDb(severity: string): string {
  return severity.toLowerCase();
}

function escalateSeverity(
  current: string | null,
  proposed: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  detectionCycles: number,
): string {
  if (detectionCycles < 2) {
    return proposed === "CRITICAL" || proposed === "HIGH" ? "moderate" : mapSeverityToDb(proposed);
  }
  const order = ["low", "moderate", "medium", "high", "critical"];
  const curIdx = order.indexOf((current ?? "moderate").toLowerCase());
  const nextIdx = order.indexOf(mapSeverityToDb(proposed));
  return order[Math.max(curIdx, nextIdx)] ?? mapSeverityToDb(proposed);
}

export async function applyBurnoutProtectiveActions(params: {
  userId: string;
  blueprintId: string;
  assessment: BurnoutRiskAssessment;
}): Promise<void> {
  const base = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    entityType: "blueprint" as const,
    entityId: params.blueprintId,
  };

  if (params.assessment.level === "HIGH" || params.assessment.level === "CRITICAL") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.LOAD_REDUCTION_REQUESTED,
      payload: {
        reason: "fatigue_trajectory",
        risk_score: params.assessment.score,
        risk_level: params.assessment.level,
        narrative: params.assessment.narrative,
        target: "ControlEngine",
      },
      idempotencyKey: `load_reduction:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
  }

  if (params.assessment.level === "CRITICAL") {
    await db
      .update(enforcementPackages)
      .set({ recovery_required: true })
      .where(
        and(
          eq(enforcementPackages.blueprint_id, params.blueprintId),
          eq(enforcementPackages.is_current, true),
        ),
      )
      .catch(() => null);

    await db
      .insert(systemHealthLogs)
      .values({
        area: "PATTERN_LEARNING",
        severity: "CRITICAL",
        blueprint_id: params.blueprintId,
        user_id: params.userId,
        check_type: "BURNOUT_PROTECTIVE_REST",
        message: "Protected rest period activated — recovery-only task generation until risk drops.",
        status: "OPEN",
        details_json: {
          risk_score: params.assessment.score,
          fired_indicators: params.assessment.firedIndicators,
          force_recovery: true,
          narrative: params.assessment.narrative,
        },
      })
      .catch(() => null);

    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.BURNOUT_RISK_DETECTED,
      payload: {
        risk_level: "CRITICAL",
        recommended_response: "protective_rest",
        narrative: params.assessment.narrative,
        force_recovery: true,
      },
      idempotencyKey: `burnout_critical:${params.blueprintId}:${Math.floor(Date.now() / 86400000)}`,
    }).catch(() => null);
  } else if (params.assessment.level === "HIGH") {
    await writeEvent({
      ...base,
      eventType: EVENT_TYPES.BURNOUT_RISK_DETECTED,
      payload: {
        risk_level: "HIGH",
        recommended_response: "load_reduction",
        narrative: params.assessment.narrative,
      },
      idempotencyKey: `burnout_high:${params.blueprintId}:${Math.floor(Date.now() / 3600000)}`,
    }).catch(() => null);
  }
}

function collectLegacyExtraPatterns(
  feedbackRows: RawFeedbackRow[],
  orderRows: Array<{ task_type: string | null; created_at: Date }>,
): PatternSpecLabel[] {
  const extra: PatternSpecLabel[] = [];

  const lowValue = feedbackRows.filter(
    (f) => f.completion_status === "completed" && (f.score ?? 0) < 5,
  ).length;
  if (meetsPatternThreshold(lowValue)) extra.push("LOW_VALUE_COMPLETION");

  const sameDifficultyFails = feedbackRows.filter(
    (f) => f.completion_status === "failed" && f.taskDifficulty === "hard",
  ).length;
  if (meetsPatternThreshold(sameDifficultyFails)) extra.push("DIFFICULTY_CEILING");

  const recoveryOrders = orderRows.filter((o) => o.task_type === "recovery").length;
  const executionOrders = orderRows.filter((o) => o.task_type === "execution").length;
  if (
    meetsPatternThreshold(recoveryOrders) &&
    executionOrders < Math.max(1, Math.floor(recoveryOrders / 2))
  ) {
    extra.push("RECOVERY_DEPENDENCE");
  }

  const driftHints = feedbackRows.filter((f) => {
    const r = (f.reflection ?? "").toLowerCase();
    return (
      f.completion_status === "completed" &&
      (r.includes("off track") || r.includes("wrong goal") || r.includes("not aligned"))
    );
  }).length;
  if (meetsPatternThreshold(driftHints)) extra.push("FOCUS_DRIFT");

  return extra;
}

export async function scanPatterns(params: {
  userId: string;
  blueprintId: string;
  windowDays?: number;
}): Promise<{ patternsDetected: number; fatigueRisk: string; burnoutRisk: boolean }> {
  const window = params.windowDays ?? 14;
  const since30 = new Date(Date.now() - 30 * 86400000);

  const feedbackRowsRaw = await db
    .select({
      id: feedback.id,
      created_at: feedback.created_at,
      completion_status: feedback.completion_status,
      score: feedback.score,
      friction_score: feedback.friction_score,
      confidence_score: feedback.confidence_score,
      order_id: feedback.order_id,
      late_penalty_applied: feedback.late_penalty_applied,
      reflection: feedback.reflection,
      duration_minutes: feedback.duration_minutes,
      submitted_hours_after_completion: feedback.submitted_hours_after_completion,
      taskDifficulty: orders.difficulty,
      taskType: orders.task_type,
      orderStartedAt: orders.started_at,
      orderCreatedAt: orders.created_at,
    })
    .from(feedback)
    .innerJoin(orders, eq(feedback.order_id, orders.id))
    .where(
      and(
        eq(feedback.user_id, params.userId),
        eq(feedback.blueprint_id, params.blueprintId),
        gte(feedback.created_at, since30),
      ),
    )
    .orderBy(asc(feedback.created_at));

  const orderRows = await db
    .select({
      id: orders.id,
      created_at: orders.created_at,
      started_at: orders.started_at,
      task_type: orders.task_type,
      difficulty: orders.difficulty,
    })
    .from(orders)
    .where(
      and(
        eq(orders.user_id, params.userId),
        eq(orders.blueprint_id, params.blueprintId),
        gte(orders.created_at, since30),
      ),
    )
    .orderBy(asc(orders.created_at));

  const joined = joinFeedbackWithOrders(feedbackRowsRaw, orderRows);

  const [{ openInactivity = 0 } = {}] = await db
    .select({ openInactivity: count() })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, params.userId),
        eq(inactivityRecords.blueprint_id, params.blueprintId),
        eq(inactivityRecords.resolved, false),
      ),
    );

  const inactivity30 = await db
    .select({
      created_at: inactivityRecords.created_at,
      resolved_at: inactivityRecords.resolved_at,
      resolved: inactivityRecords.resolved,
    })
    .from(inactivityRecords)
    .where(
      and(
        eq(inactivityRecords.user_id, params.userId),
        eq(inactivityRecords.blueprint_id, params.blueprintId),
        gte(inactivityRecords.created_at, since30),
      ),
    );

  let recoveryResolvedWithin3Days = 0;
  for (const rec of inactivity30) {
    if (!rec.resolved || !rec.resolved_at) continue;
    const days = (rec.resolved_at.getTime() - rec.created_at.getTime()) / 86400000;
    if (days <= 3) recoveryResolvedWithin3Days++;
  }

  const evidence = normalizeBehaviorEvidence({
    feedbackRows: joined,
    orderRows,
    hasOpenInactivity: Number(openInactivity) > 0,
    inactivityCount30d: inactivity30.length,
    recoveryResolvedWithin3Days,
  });

  const recoveryFailed = joined
    .filter((r) => r.taskType === "recovery")
    .slice(-3)
    .some((r) => r.completion_status === "failed" || r.completion_status === "skipped");

  const burnoutAssessment = scoreBurnoutRisk(evidence, {
    inactivityAfterHardFailure: Number(openInactivity) > 0,
    recoveryTaskFailedOrSkipped: recoveryFailed,
  });

  const [capability] = await db
    .select({
      fatigue_risk: capabilityProfiles.fatigue_risk,
      metadata: capabilityProfiles.metadata,
    })
    .from(capabilityProfiles)
    .where(eq(capabilityProfiles.user_id, params.userId))
    .limit(1);

  const difficultyHandling =
    capability?.metadata && typeof capability.metadata === "object" && !Array.isArray(capability.metadata)
      ? String((capability.metadata as Record<string, unknown>).difficulty_handling ?? "")
      : null;

  const openFalseProgress = await getOpenFlags(params.blueprintId);
  const extraLabels = collectLegacyExtraPatterns(joined, orderRows);
  if (openFalseProgress.length > 0) extraLabels.push("FALSE_PROGRESS_PATTERN");

  const lateCount = evidence.w7.feedbackCount
    ? joined.filter((f) => f.late_penalty_applied && f.created_at >= new Date(Date.now() - window * 86400000)).length
    : 0;

  const fatigueRiskScore = FATIGUE_RISK_SCORE[capability?.fatigue_risk ?? "low"] ?? 0.2;
  const burnoutSignalCount = countBurnoutSignals({
    failureRate: evidence.w7.failedCount / Math.max(1, evidence.w7.feedbackCount),
    inactivityCount: inactivity30.length,
    lateCount,
    fatigueRiskScore,
  });

  let burnoutRisk = burnoutAssessment.level === "HIGH" || burnoutAssessment.level === "CRITICAL";
  if (burnoutSignalCount >= 3) {
    burnoutRisk = true;
    if (!extraLabels.includes("BURNOUT_RISK")) extraLabels.push("BURNOUT_RISK");
  }

  const detected = detectPatternsFromEvidence(evidence, {
    difficultyHandling,
    signalTrendDeclining: evidence.w7.completionRate < 0.4 && evidence.w3.feedbackCount === 0,
    burnoutScore: burnoutAssessment.score,
    extraLabels,
  });

  const fatigueRisk = burnoutAssessment.level;
  let patternsDetected = 0;

  for (const pattern of detected) {
    const dbType = mapSpecLabelToDbType(pattern.label);
    const specFilter = sql`(${behaviorPatterns.evidence_json})::jsonb->>'spec_label' = ${pattern.label}`;

    const [existing] = await db
      .select()
      .from(behaviorPatterns)
      .where(
        and(
          eq(behaviorPatterns.user_id, params.userId),
          eq(behaviorPatterns.blueprint_id, params.blueprintId),
          eq(behaviorPatterns.pattern_type, dbType),
          eq(behaviorPatterns.status, "active"),
          specFilter,
        ),
      )
      .limit(1);

    const detectionCycles = existing ? existing.frequency + 1 : 1;
    const severity = escalateSeverity(existing?.severity ?? null, pattern.severity, detectionCycles);

    const evidenceJson = {
      spec_label: pattern.label,
      window_days: pattern.windowDays,
      fatigue_risk_band: fatigueRisk,
      burnout_score: burnoutAssessment.score,
      burnout_signals: burnoutSignalCount,
      detection_cycles: detectionCycles,
      ...pattern.evidence,
    };

    if (!existing) {
      const [created] = await db
        .insert(behaviorPatterns)
        .values({
          user_id: params.userId,
          blueprint_id: params.blueprintId,
          pattern_type: dbType,
          severity,
          confidence: joined.length >= 7 ? 0.8 : 0.6,
          frequency: 1,
          status: "active",
          evidence_json: evidenceJson,
          first_detected_at: new Date(),
          last_detected_at: new Date(),
        })
        .returning({ id: behaviorPatterns.id });

      patternsDetected++;

      if (created) {
        const scores = calculatePatternScores({
          occurrenceCount: joined.length,
          windowSize: Math.max(7, window),
          impactOnCompletion: evidence.w7.failedCount / Math.max(1, evidence.w7.feedbackCount),
          trendDelta: evidence.w7.completionRate - evidence.w14.completionRate,
          crossTypeStability: 0.7,
        });
        await db.insert(behaviorEvents).values({
          user_id: params.userId,
          blueprint_id: params.blueprintId,
          pattern_id: created.id,
          event_type: "pattern_detected",
          data_json: {
            spec_label: pattern.label,
            fatigue_risk: fatigueRisk,
            scores,
            burnout_score: burnoutAssessment.score,
          },
        });
        await emitPatternResponseEvent({
          pattern: pattern.label,
          userId: params.userId,
          blueprintId: params.blueprintId,
          patternId: created.id,
          riskScore: burnoutAssessment.score / 100,
        });

        const sevUpper = String(severity).toUpperCase();
        if (["HIGH", "CRITICAL"].includes(sevUpper) || ["high", "critical"].includes(severity)) {
          await DecisionTraceService.write({
            userId: params.userId,
            blueprintId: params.blueprintId,
            decisionType: "SYSTEM_CORRECTION",
            decisionKey: `pattern:${pattern.label}:${created.id}`,
            selectedOption: pattern.label,
            optionsConsidered: [pattern.label],
            rationaleSummary: `Pattern ${pattern.label} detected at ${severity} severity`,
            sourceEngine: "PatternLearningEngine",
            confidence: "HIGH",
            stateVersion: await getBlueprintStateVersion(params.blueprintId).catch(() => 0),
            causationEventId: created.id,
          }).catch(() => null);
        }
      }
    } else {
      await db
        .update(behaviorPatterns)
        .set({
          last_detected_at: new Date(),
          frequency: existing.frequency + 1,
          severity,
          evidence_json: evidenceJson,
        })
        .where(eq(behaviorPatterns.id, existing.id));
    }
  }

  await applyBurnoutProtectiveActions({
    userId: params.userId,
    blueprintId: params.blueprintId,
    assessment: burnoutAssessment,
  });

  const active = await getActivePatterns(params.userId, params.blueprintId);
  const toResolve = evaluatePatternResolutions(active, evidence);
  let resolved = 0;
  for (const patternId of toResolve) {
    await resolvePattern(patternId, "resolution_condition_met");
    resolved++;
  }

  logger.info(
    {
      blueprintId: params.blueprintId,
      patterns: detected.map((p) => p.label).join(", "),
      fatigueRisk,
      burnoutRisk,
      detected: patternsDetected,
      resolved,
      burnoutScore: burnoutAssessment.score,
    },
    "[PatternEngine] Scan complete",
  );

  return { patternsDetected, fatigueRisk, burnoutRisk };
}

/** Phase 4 — scan all active blueprints (daily cron). */
export async function scanAll(): Promise<{ scanned: number; patternsDetected: number }> {
  const rows = await db
    .select({ id: blueprints.id, user_id: blueprints.user_id })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, BlueprintStatus.ACTIVE)));

  let patternsDetected = 0;
  for (const bp of rows) {
    const result = await scanPatterns({
      userId: bp.user_id,
      blueprintId: bp.id,
      windowDays: 14,
    });
    patternsDetected += result.patternsDetected;
  }

  logger.info({ scanned: rows.length, patternsDetected }, "[PatternEngine] scanAll complete");
  return { scanned: rows.length, patternsDetected };
}

export class PatternLearningEngine {
  scanForUser(userId: string, blueprintId: string, windowDays = 14) {
    return scanPatterns({ userId, blueprintId, windowDays });
  }

  scanAll() {
    return scanAll();
  }
}

export async function resolvePattern(patternId: string, _reason?: string): Promise<void> {
  void _reason;
  await db
    .update(behaviorPatterns)
    .set({ status: "resolved", resolved_at: new Date() })
    .where(eq(behaviorPatterns.id, patternId));
}

export async function getActivePatterns(
  userId: string,
  blueprintId: string,
): Promise<(typeof behaviorPatterns.$inferSelect)[]> {
  return db
    .select()
    .from(behaviorPatterns)
    .where(
      and(
        eq(behaviorPatterns.user_id, userId),
        eq(behaviorPatterns.blueprint_id, blueprintId),
        eq(behaviorPatterns.status, "active"),
      ),
    )
    .orderBy(desc(behaviorPatterns.last_detected_at));
}

export { detectDelayPattern } from "./PatternDetector.js";
