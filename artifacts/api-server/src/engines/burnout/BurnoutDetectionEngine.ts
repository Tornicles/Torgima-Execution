/**
 * Prompt 7 §3 — Deterministic burnout scoring. Never overrides conditions.
 */
import { db, feedback, burnoutRecords } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { writeMemory } from "../../bhudhi/MemoryService.js";
import { applyExecutionLanguage } from "../../bhudhi/AdaptiveCommunicationEngine.js";

export type BurnoutRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface BurnoutSignals {
  completionRateDrop: number;
  scoreVsCompletionGap: number;
  reflectionLengthDrop: number;
  sessionFrequencyDrop: number;
  consecutiveDeclines: number;
  inactivitySpikes: number;
}

export interface TaskGenerationAdjustment {
  reduceComplexity: boolean;
  maxDifficulty: number;
  prioritizeMeaning: boolean;
  suppressScaling: boolean;
}

export function computeBurnoutScore(signals: BurnoutSignals): number {
  let score = 0;
  if (signals.completionRateDrop > 0.25) score += 0.25;
  if (signals.completionRateDrop > 0.4) score += 0.15;
  if (signals.scoreVsCompletionGap > 0.3) score += 0.2;
  if (signals.reflectionLengthDrop > 0.4) score += 0.15;
  if (signals.consecutiveDeclines >= 5) score += 0.15;
  if (signals.inactivitySpikes >= 3) score += 0.1;
  return Math.min(1, score);
}

export function riskLevelFromScore(score: number): BurnoutRiskLevel {
  if (score >= 0.56) return "HIGH";
  if (score >= 0.31) return "MEDIUM";
  return "LOW";
}

export async function collectBurnoutSignals(userId: string): Promise<BurnoutSignals> {
  const since = new Date(Date.now() - 14 * 86400000);
  const rows = await db
    .select({
      created_at: feedback.created_at,
      completion_status: feedback.completion_status,
      score: feedback.score,
      reflection: feedback.reflection,
    })
    .from(feedback)
    .where(and(eq(feedback.user_id, userId), gte(feedback.created_at, since)))
    .orderBy(desc(feedback.created_at))
    .limit(40);

  if (rows.length < 4) {
    return {
      completionRateDrop: 0,
      scoreVsCompletionGap: 0,
      reflectionLengthDrop: 0,
      sessionFrequencyDrop: 0,
      consecutiveDeclines: 0,
      inactivitySpikes: 0,
    };
  }

  const chron = [...rows].reverse();
  const mid = Math.floor(chron.length / 2);
  const recent = chron.slice(mid);
  const prior = chron.slice(0, mid);
  type Row = (typeof rows)[number];
  const rate = (arr: Row[]) =>
    arr.filter((r) => r.completion_status === "completed").length / Math.max(1, arr.length);
  const avgScore = (arr: Row[]) =>
    arr.reduce((s, r) => s + (r.score ?? 0), 0) / Math.max(1, arr.length);
  const avgReflection = (arr: Row[]) =>
    arr.reduce((s, r) => s + (r.reflection?.length ?? 0), 0) / Math.max(1, arr.length);

  const priorRate = rate(prior);
  const recentRate = rate(recent);
  const completionRateDrop = Math.max(0, priorRate - recentRate);
  const scoreVsCompletionGap = Math.max(0, avgScore(recent) / 10 - recentRate);

  const priorRef = avgReflection(prior);
  const recentRef = avgReflection(recent);
  const reflectionLengthDrop =
    priorRef > 0 ? Math.max(0, (priorRef - recentRef) / priorRef) : 0;

  let consecutiveDeclines = 0;
  for (const r of rows) {
    if ((r.score ?? 0) < 6 || r.completion_status === "failed") consecutiveDeclines++;
    else break;
  }

  const daySet = new Set(rows.map((r) => r.created_at.toISOString().slice(0, 10)));
  const inactivitySpikes = Math.max(0, 7 - daySet.size);

  return {
    completionRateDrop,
    scoreVsCompletionGap,
    reflectionLengthDrop,
    sessionFrequencyDrop: 0,
    consecutiveDeclines,
    inactivitySpikes,
  };
}

export function getBurnoutAdjustment(record: {
  risk_level: string;
}): TaskGenerationAdjustment {
  if (record.risk_level === "HIGH") {
    return {
      reduceComplexity: true,
      maxDifficulty: 4,
      prioritizeMeaning: true,
      suppressScaling: true,
    };
  }
  if (record.risk_level === "MEDIUM") {
    return {
      reduceComplexity: true,
      maxDifficulty: 6,
      prioritizeMeaning: false,
      suppressScaling: false,
    };
  }
  return {
    reduceComplexity: false,
    maxDifficulty: 10,
    prioritizeMeaning: false,
    suppressScaling: false,
  };
}

export async function scoreBurnoutRisk(userId: string) {
  const signals = await collectBurnoutSignals(userId);
  const riskScore = computeBurnoutScore(signals);
  const riskLevel = riskLevelFromScore(riskScore);

  const evidenceFactors = [
    { factor: "completionRateDrop", value: signals.completionRateDrop, weight: 0.25 },
    { factor: "scoreVsCompletionGap", value: signals.scoreVsCompletionGap, weight: 0.2 },
    { factor: "reflectionLengthDrop", value: signals.reflectionLengthDrop, weight: 0.15 },
    { factor: "consecutiveDeclines", value: signals.consecutiveDeclines, weight: 0.15 },
    { factor: "inactivitySpikes", value: signals.inactivitySpikes, weight: 0.1 },
  ];

  const recommendation =
    riskLevel === "HIGH"
      ? applyExecutionLanguage(
          "Recovery-oriented Orders recommended. Reduce complexity and reconnect to Blueprint purpose.",
        )
      : riskLevel === "MEDIUM"
        ? "Monitor execution load; simplify next Orders."
        : "Trajectory stable within current window.";

  const [record] = await db
    .insert(burnoutRecords)
    .values({
      user_id: userId,
      risk_level: riskLevel,
      risk_score: riskScore,
      evidence_factors: evidenceFactors,
      completion_rate_drop: signals.completionRateDrop,
      score_divergence: signals.scoreVsCompletionGap,
      reflection_quality_drop: signals.reflectionLengthDrop,
      consecutive_declines: signals.consecutiveDeclines,
      session_frequency_drop: signals.sessionFrequencyDrop,
      recommendation,
    })
    .returning();

  if (riskLevel === "HIGH") {
    await writeMemory({
      userId,
      memoryType: "EXECUTION_PATTERN",
      scope: "USER",
      content: recommendation,
      sourceType: "burnout_engine",
      confidence: "HIGH",
    }).catch(() => null);
  }

  return record!;
}

export async function getLatestBurnoutRecord(userId: string) {
  const [row] = await db
    .select()
    .from(burnoutRecords)
    .where(eq(burnoutRecords.user_id, userId))
    .orderBy(desc(burnoutRecords.created_at))
    .limit(1);
  return row ?? null;
}
