import { db, agentRegistry, criticReviewLogs, fallbackUsageLogs, predictionLogs, bhudhiLogs } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { writeMemory } from "../MemoryService.js";
import { runWeeklyCalibrationFromPredictions } from "../../engines/meta/MetaCognitionEngine.js";
import { getStabilityEventsForUser } from "../../engines/stability/StabilityEngine.js";
import type { BhudhiTriggerType } from "../../types/bhudhi.js";
import { getAllContracts } from "../PromptRegistry.js";

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

export interface IntelligenceQualityReport {
  agents: Array<{
    agentName: string;
    lowConfidenceRate: number;
    averageConfidence: number;
    flagged: boolean;
  }>;
  contracts: Array<{
    contract: string;
    fallbackRate: number;
    flagged: boolean;
  }>;
  generatedAt: string;
}

export async function generateIntelligenceQualityReport(): Promise<IntelligenceQualityReport> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const predictions: Array<typeof predictionLogs.$inferSelect> = await db
    .select()
    .from(predictionLogs)
    .where(gte(predictionLogs.created_at, since))
    .catch(() => [] as Array<typeof predictionLogs.$inferSelect>);
  const fallbacks: Array<typeof fallbackUsageLogs.$inferSelect> = await db
    .select()
    .from(fallbackUsageLogs)
    .where(gte(fallbackUsageLogs.created_at, since))
    .catch(() => [] as Array<typeof fallbackUsageLogs.$inferSelect>);

  const byAgent = new Map<string, Array<typeof predictionLogs.$inferSelect>>();
  for (const prediction of predictions) {
    const rows = byAgent.get(prediction.agent_name) ?? [];
    rows.push(prediction);
    byAgent.set(prediction.agent_name, rows);
  }

  const agents = [...byAgent.entries()].map(([agentName, rows]) => {
    const low = rows.filter((r) => r.confidence_tier === "LOW").length;
    const averageConfidence =
      rows.reduce((sum, r) => sum + Number(r.confidence_level ?? 0.5), 0) / Math.max(1, rows.length);
    const lowConfidenceRate = low / Math.max(1, rows.length);
    return {
      agentName,
      lowConfidenceRate,
      averageConfidence,
      flagged: lowConfidenceRate > 0.3,
    };
  });

  const contracts = [...getAllContracts().values()].map((contract) => {
    const matchingFallbacks = fallbacks.filter((f) => f.prompt_name === contract.name || f.trigger_type === contract.triggerType);
    const matchingLogs = predictions.filter((p) => p.prediction_type === contract.name || p.prediction_type === contract.triggerType);
    const fallbackRate = matchingFallbacks.length / Math.max(1, matchingFallbacks.length + matchingLogs.length);
    return {
      contract: contract.name,
      fallbackRate,
      flagged: fallbackRate > 0.2,
    };
  });

  return { agents, contracts, generatedAt: new Date().toISOString() };
}

export async function optimizeAgentRouting(): Promise<number> {
  const report = await generateIntelligenceQualityReport();
  let changed = 0;
  for (const agent of report.agents) {
    const delta = agent.flagged ? -0.03 : 0.02;
    await updateAgentRoutingPriority(agent.agentName, "*", delta);
    changed++;
  }

  if (changed === 0) {
    const [row] = await db
      .select()
      .from(agentRegistry)
      .orderBy(desc(agentRegistry.created_at))
      .limit(1)
      .catch(() => [] as Array<typeof agentRegistry.$inferSelect>);
    if (row) {
      await updateAgentRoutingPriority(row.agent_name, "*", 0.01);
      changed = 1;
    }
  }

  return changed;
}

export async function auditPromptContracts(): Promise<
  Array<{ contract: string; avgTier: "HIGH" | "MEDIUM" | "LOW"; fallbackRate: number; needsRevision: boolean }>
> {
  const report = await generateIntelligenceQualityReport();
  return report.contracts.map((c) => ({
    contract: c.contract,
    avgTier: c.flagged ? "LOW" : "MEDIUM",
    fallbackRate: c.fallbackRate,
    needsRevision: c.flagged,
  }));
}

export const FORBIDDEN_OUTPUT_PHRASES = [
  "I have updated",
  "I have changed",
  "I have set",
  "signal is now",
  "condition has been changed to",
  "blueprint has been updated",
  "task has been marked complete",
  "I approve",
  "you may proceed",
  "phase is complete",
] as const;

export async function scanBhudhiAuthorityClaims(): Promise<number> {
  const rows: Array<{ raw_response: string | null; output_json: unknown }> = await db
    .select({ raw_response: bhudhiLogs.raw_response, output_json: bhudhiLogs.output_json })
    .from(bhudhiLogs)
    .catch(() => [] as Array<{ raw_response: string | null; output_json: unknown }>);
  return rows.filter((row) => {
    const text = `${row.raw_response ?? ""} ${JSON.stringify(row.output_json ?? {})}`.toLowerCase();
    return FORBIDDEN_OUTPUT_PHRASES.some((phrase) => text.includes(phrase.toLowerCase()));
  }).length;
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
