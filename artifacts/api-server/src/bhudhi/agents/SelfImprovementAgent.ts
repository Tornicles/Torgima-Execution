import { db, agentRegistry, criticReviewLogs, fallbackUsageLogs } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeMemory } from "../MemoryService.js";
import { runWeeklyCalibrationFromPredictions } from "../../engines/meta/MetaCognitionEngine.js";
import { getStabilityEventsForUser } from "../../engines/stability/StabilityEngine.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";

export async function runDailyEvaluation(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const reviews = await db
    .select()
    .from(criticReviewLogs)
    .where(and(eq(criticReviewLogs.user_id, userId), gte(criticReviewLogs.created_at, since)));

  const rejections = reviews.filter(r => r.verdict === "REJECTED");
  const byAgent = new Map<string, number>();
  for (const r of rejections) {
    byAgent.set(r.input_agent, (byAgent.get(r.input_agent) ?? 0) + 1);
  }

  const fallbacks = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fallbackUsageLogs)
    .where(and(eq(fallbackUsageLogs.user_id, userId), gte(fallbackUsageLogs.created_at, since)));

  const fallbackCount = fallbacks[0]?.count ?? 0;

  for (const [agentName, count] of byAgent) {
    if (count < 2) continue;
    const delta = -0.05 * count;
    await updateAgentRoutingPriority(agentName, "TASK_DRAFTING", delta);
  }

  if (reviews.length > 0 || fallbackCount > 0) {
    await writeMemory({
      userId,
      memoryType: "EXECUTION_PATTERN",
      scope: "USER",
      content: `Daily Bhudhi eval: ${reviews.length} critic reviews, ${rejections.length} rejections, ${fallbackCount} fallbacks.`,
      sourceType: "self_improvement_agent",
      confidence: "MEDIUM",
    }).catch(() => null);
  }

  logger.info({ userId, reviews: reviews.length, fallbacks: fallbackCount }, "[SelfImprovement] Daily evaluation");
}

export async function runWeeklyCalibration(): Promise<void> {
  const calibrated = await runWeeklyCalibrationFromPredictions();
  const report = await import("../../engines/meta/MetaCognitionEngine.js").then(m =>
    m.getDomainReliabilityReport(),
  );

  logger.info({ calibrated, agents: report.length }, "[SelfImprovement] Weekly calibration");
}

export async function updateAgentRoutingPriority(
  agentName: string,
  _triggerType: BhudhiTriggerType | string,
  qualityDelta: number,
): Promise<void> {
  const [row] = await db
    .select()
    .from(agentRegistry)
    .where(eq(agentRegistry.agent_name, agentName))
    .limit(1);

  if (!row) return;

  const current = row.quality_score ?? 0.75;
  const next = Math.min(1, Math.max(0.1, current + qualityDelta));

  await db
    .update(agentRegistry)
    .set({ quality_score: next })
    .where(eq(agentRegistry.agent_name, agentName));
}

export async function writeStabilityPatternSummary(userId: string): Promise<void> {
  const events = await getStabilityEventsForUser(userId, 24);
  if (events.length === 0) return;

  const summary = events
    .slice(0, 5)
    .map(e => `${e.event_type}: ${e.description}`)
    .join("; ");

  await writeMemory({
    userId,
    memoryType: "FRICTION_PATTERN",
    scope: "USER",
    content: `Stability patterns (24h): ${summary}`,
    sourceType: "stability_engine",
    confidence: "MEDIUM",
  }).catch(() => null);
}
