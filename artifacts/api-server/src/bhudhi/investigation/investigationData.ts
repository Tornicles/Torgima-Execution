/**
 * Drizzle-backed data accessors for investigation engines.
 */
import {
  db,
  orders,
  feedback,
  orderDependencies,
  signalSnapshots,
  conditions,
  blueprints,
  bhudhiExecutionEvents,
  bhudhiExternalConnections,
  validations,
  failureClassifications,
} from "@workspace/db";
import { and, count, desc, eq, sql } from "drizzle-orm";

export interface ExecutionDataSnapshot {
  taskCount: number;
  completedCount: number;
  activeCount: number;
  blockedCount: number;
  feedbackCount: number;
  tasksPerDay: number;
  feedbackRate: number;
  dataPoints: number;
  avgFriction: number;
  avgCompletionHours: number;
  gamingFlags: number;
}

export interface ExecutionEventRow {
  id: string;
  eventType: string;
  description: string;
  createdAt: Date;
}

export interface AnomalyRecord {
  description: string;
  severity: "low" | "medium" | "high";
}

export interface PatternRecord {
  name: string;
  frequency: number;
}

export interface CorrelationRecord {
  a: string;
  b: string;
  strength: number;
}

export interface RootCauseRecord {
  cause: string;
  confidence: number;
}

export interface BenchmarkGap {
  metric: string;
  percentDiff: number;
}

export interface DependencyNode {
  id: string;
  blockingId: string;
  blockedId: string;
  status: string;
}

export interface VulnerabilityRecord {
  name: string;
  risk: "low" | "medium" | "high";
}

const DOMAIN_BENCHMARKS: Record<string, { completionRate: number; feedbackRate: number; velocity: number }> = {
  genesis:    { completionRate: 0.55, feedbackRate: 0.85, velocity: 5 },
  market:     { completionRate: 0.5,  feedbackRate: 0.8,  velocity: 4 },
  delivery:   { completionRate: 0.6,  feedbackRate: 0.9,  velocity: 7 },
  operations: { completionRate: 0.58, feedbackRate: 0.88, velocity: 6 },
  growth:     { completionRate: 0.52, feedbackRate: 0.82, velocity: 5 },
  continuity: { completionRate: 0.48, feedbackRate: 0.75, velocity: 4 },
  people:     { completionRate: 0.54, feedbackRate: 0.86, velocity: 5 },
};

export async function loadBlueprint(blueprintId: string) {
  const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, blueprintId)).limit(1);
  return bp ?? null;
}

export async function getExecutionData(blueprintId: string): Promise<ExecutionDataSnapshot> {
  const [orderStats] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')`,
      active: sql<number>`count(*) filter (where ${orders.status} in ('pending', 'active'))`,
      blocked: sql<number>`count(*) filter (where ${orders.blocker_type} is not null)`,
    })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  const [fbStats] = await db
    .select({
      total: count(),
      avgFriction: sql<number>`coalesce(avg(${feedback.friction_score}), 0)`,
      gaming: sql<number>`count(*) filter (where ${feedback.gaming_flag} = true)`,
    })
    .from(feedback)
    .where(eq(feedback.blueprint_id, blueprintId));

  const bp = await loadBlueprint(blueprintId);
  const daysActive = bp?.created_at
    ? Math.max(1, (Date.now() - bp.created_at.getTime()) / (1000 * 60 * 60 * 24))
    : 1;

  const taskCount = Number(orderStats?.total ?? 0);
  const completedCount = Number(orderStats?.completed ?? 0);
  const feedbackCount = Number(fbStats?.total ?? 0);

  return {
    taskCount,
    completedCount,
    activeCount: Number(orderStats?.active ?? 0),
    blockedCount: Number(orderStats?.blocked ?? 0),
    feedbackCount,
    tasksPerDay: Math.round((taskCount / daysActive) * 10) / 10,
    feedbackRate: taskCount > 0 ? Math.round((feedbackCount / taskCount) * 100) / 100 : 0,
    dataPoints: taskCount + feedbackCount + Number(orderStats?.blocked ?? 0),
    avgFriction: Number(fbStats?.avgFriction ?? 0),
    avgCompletionHours: 0,
    gamingFlags: Number(fbStats?.gaming ?? 0),
  };
}

export async function getExternalData(blueprintId: string) {
  const rows = await db
    .select()
    .from(bhudhiExternalConnections)
    .where(eq(bhudhiExternalConnections.blueprint_id, blueprintId));
  return {
    connectionCount: rows.length,
    dataPoints: rows.filter((r) => r.last_sync_at).length,
    systems: rows.map((r) => r.system_name),
  };
}

export async function getExecutionEvents(blueprintId: string): Promise<ExecutionEventRow[]> {
  const rows = await db
    .select()
    .from(bhudhiExecutionEvents)
    .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExecutionEvents.created_at))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    description: r.description,
    createdAt: r.created_at,
  }));
}

export function findRecurringPatterns(events: ExecutionEventRow[]): PatternRecord[] {
  const freq = new Map<string, number>();
  for (const e of events) {
    freq.set(e.eventType, (freq.get(e.eventType) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .map(([name, frequency]) => ({ name, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
}

export function findCorrelations(data: ExecutionDataSnapshot): CorrelationRecord[] {
  const out: CorrelationRecord[] = [];
  if (data.blockedCount > 0 && data.feedbackRate < 0.5) {
    out.push({ a: "blocked_orders", b: "low_feedback_rate", strength: 72 });
  }
  if (data.gamingFlags > 0 && data.avgFriction > 0.6) {
    out.push({ a: "gaming_flags", b: "high_friction", strength: 65 });
  }
  if (data.completedCount > 0 && data.feedbackCount < data.completedCount * 0.5) {
    out.push({ a: "completions", b: "missing_feedback", strength: 80 });
  }
  return out;
}

export function detectAnomalies(data: ExecutionDataSnapshot): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];
  if (data.feedbackRate < 0.4 && data.taskCount >= 5) {
    anomalies.push({
      description: `Feedback rate ${(data.feedbackRate * 100).toFixed(0)}% is below expected 40% threshold`,
      severity: "medium",
    });
  }
  if (data.gamingFlags >= 2) {
    anomalies.push({
      description: `${data.gamingFlags} feedback entries flagged as potential gaming`,
      severity: "high",
    });
  }
  if (data.blockedCount > data.activeCount && data.taskCount > 3) {
    anomalies.push({
      description: `Blocked orders (${data.blockedCount}) exceed active queue (${data.activeCount})`,
      severity: "medium",
    });
  }
  if (data.tasksPerDay > 15) {
    anomalies.push({
      description: `Throughput spike: ${data.tasksPerDay} tasks/day exceeds typical 15/day ceiling`,
      severity: "low",
    });
  }
  return anomalies;
}

export async function getStoredAnomalies(blueprintId: string): Promise<AnomalyRecord[]> {
  const data = await getExecutionData(blueprintId);
  return detectAnomalies(data);
}

export async function analyzeRootCause(
  blueprintId: string,
  anomaly: AnomalyRecord,
): Promise<RootCauseRecord | null> {
  const [condition] = await db
    .select()
    .from(conditions)
    .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
    .limit(1);

  const conditionName = condition?.condition ?? "unknown";
  if (anomaly.description.includes("gaming")) {
    return { cause: `Proof/evidence gap under ${conditionName} condition`, confidence: 0.78 };
  }
  if (anomaly.description.includes("Feedback rate")) {
    return { cause: `Feedback loop breakdown — operators completing without reflection`, confidence: 0.82 };
  }
  if (anomaly.description.includes("Blocked orders")) {
    return { cause: `Dependency chain congestion or unclear unlock criteria`, confidence: 0.75 };
  }
  return { cause: `Operational drift during ${conditionName} condition`, confidence: 0.6 };
}

export async function getBlueprintMetrics(blueprintId: string) {
  const [signal] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);
  const exec = await getExecutionData(blueprintId);
  return {
    completionRate: signal?.completion_rate ?? (exec.taskCount ? exec.completedCount / exec.taskCount : 0),
    momentum: signal?.momentum ?? 0,
    weightedScore: signal?.weighted_score ?? 0,
    velocity: exec.tasksPerDay,
    feedbackRate: exec.feedbackRate,
    quality: exec.taskCount ? 1 - exec.gamingFlags / Math.max(1, exec.feedbackCount) : 1,
  };
}

export function getBenchmarks(domain: string) {
  return DOMAIN_BENCHMARKS[domain] ?? DOMAIN_BENCHMARKS.delivery!;
}

export function calculateGaps(
  metrics: { completionRate: number; feedbackRate: number; velocity: number },
  benchmarks: { completionRate: number; feedbackRate: number; velocity: number },
): BenchmarkGap[] {
  const gaps: BenchmarkGap[] = [];
  const cmp = (metric: string, actual: number, target: number) => {
    if (target <= 0) return;
    const diff = ((target - actual) / target) * 100;
    if (diff > 5) gaps.push({ metric, percentDiff: Math.round(diff) });
  };
  cmp("completion_rate", metrics.completionRate, benchmarks.completionRate);
  cmp("feedback_rate", metrics.feedbackRate, benchmarks.feedbackRate);
  cmp("velocity", metrics.velocity, benchmarks.velocity);
  return gaps;
}

export function mineHiddenInsights(data: ExecutionDataSnapshot): string[] {
  const insights: string[] = [];
  if (data.feedbackRate > 0.9 && data.avgFriction < 0.3) {
    insights.push("High feedback compliance with low friction — execution rhythm is stable");
  }
  if (data.completedCount > 0 && data.feedbackCount === 0) {
    insights.push("Silent completion pattern: tasks finish without feedback capture");
  }
  if (data.activeCount === 0 && data.taskCount > 0) {
    insights.push("Queue exhaustion: no active orders despite historical task volume");
  }
  return insights;
}

export async function mapDependencies(blueprintId: string): Promise<DependencyNode[]> {
  const rows = await db
    .select()
    .from(orderDependencies)
    .where(eq(orderDependencies.blueprint_id, blueprintId));
  return rows.map((r) => ({
    id: r.id,
    blockingId: r.blocking_order_id,
    blockedId: r.blocked_order_id,
    status: r.status,
  }));
}

export function findCriticalPaths(deps: DependencyNode[]): DependencyNode[] {
  const pending = deps.filter((d) => d.status === "pending");
  return pending.slice(0, Math.min(5, pending.length));
}

export function findBottlenecks(deps: DependencyNode[]): DependencyNode[] {
  const blockedCounts = new Map<string, number>();
  for (const d of deps.filter((x) => x.status === "pending")) {
    blockedCounts.set(d.blockingId, (blockedCounts.get(d.blockingId) ?? 0) + 1);
  }
  const max = Math.max(0, ...blockedCounts.values());
  if (max < 2) return [];
  return deps.filter((d) => (blockedCounts.get(d.blockingId) ?? 0) >= 2);
}

export async function assessVulnerabilities(blueprintId: string): Promise<VulnerabilityRecord[]> {
  const exec = await getExecutionData(blueprintId);
  const vulns: VulnerabilityRecord[] = [];
  if (exec.gamingFlags > 0) {
    vulns.push({ name: "False progress / gaming feedback", risk: exec.gamingFlags >= 3 ? "high" : "medium" });
  }
  if (exec.feedbackRate < 0.5) {
    vulns.push({ name: "Weak feedback loop", risk: "medium" });
  }
  const ext = await getExternalData(blueprintId);
  if (ext.connectionCount === 0) {
    vulns.push({ name: "No external system visibility", risk: "low" });
  }
  return vulns;
}

export async function getFinancialData(blueprintId: string) {
  const bp = await loadBlueprint(blueprintId);
  const meta = (bp?.intel_metadata ?? {}) as Record<string, unknown>;
  const revenue = typeof meta["revenue"] === "number" ? meta["revenue"] : 0;
  const burnRate = typeof meta["burnRate"] === "number" ? meta["burnRate"] : 0;
  const runway = burnRate > 0 ? Math.round((revenue / burnRate) * 10) / 10 : 0;
  const margin = typeof meta["margin"] === "number" ? meta["margin"] : 0;
  return { revenue, burnRate, runway, margin };
}

export async function getOperationalMetrics(blueprintId: string) {
  const m = await getBlueprintMetrics(blueprintId);
  return {
    velocity: m.velocity,
    throughput: m.velocity,
    quality: Math.round(m.quality * 100),
    utilization: Math.round(m.completionRate * 100),
  };
}

export async function gatherCompetitiveData(blueprintId: string) {
  const [val] = await db
    .select()
    .from(validations)
    .where(eq(validations.blueprint_id, blueprintId))
    .orderBy(desc(validations.created_at))
    .limit(1);
  const intel = (val?.intelligence ?? {}) as Record<string, unknown>;
  const competitors = Array.isArray(intel["competitors"]) ? intel["competitors"] : [];
  const insights: string[] = [];
  if (competitors.length > 0) {
    insights.push(`Validation intelligence lists ${competitors.length} competitor reference(s)`);
  } else {
    insights.push("No competitive intelligence in latest validation — run Erector validation for market grounding");
  }
  return {
    competitors,
    marketShare: typeof intel["marketShare"] === "number" ? intel["marketShare"] : 0,
    insights,
  };
}

export async function analyzeSentiment(blueprintId: string) {
  const rows = await db
    .select({ reflection: feedback.reflection, friction: feedback.friction_score, gaming: feedback.gaming_flag })
    .from(feedback)
    .where(eq(feedback.blueprint_id, blueprintId))
    .orderBy(desc(feedback.created_at))
    .limit(50);

  let sentimentSum = 0;
  let count = 0;
  const anomalies: string[] = [];
  for (const r of rows) {
    if (r.friction != null) {
      sentimentSum += 1 - Math.min(1, r.friction);
      count++;
    }
    if (r.gaming) anomalies.push("Gaming-flagged feedback detected");
    if (r.reflection && r.reflection.length < 20) {
      anomalies.push("Shallow reflection detected on recent feedback");
    }
  }
  const avgSentiment = count > 0 ? sentimentSum / count : 0.75;
  const insights: string[] = [];
  if (avgSentiment < 0.5) insights.push("Operator friction elevated across recent feedback");
  if (rows.length === 0) insights.push("No feedback samples — sentiment baseline unavailable");
  return {
    anomalies: [...new Set(anomalies)],
    insights,
    avgSentiment: Math.round(avgSentiment * 100) / 100,
    morale: avgSentiment >= 0.7 ? "good" : avgSentiment >= 0.5 ? "mixed" : "strained",
  };
}

export async function assessCompliance(blueprintId: string) {
  const failures = await db
    .select({ id: failureClassifications.id })
    .from(failureClassifications)
    .innerJoin(feedback, eq(failureClassifications.feedback_id, feedback.id))
    .where(eq(feedback.blueprint_id, blueprintId));

  const exec = await getExecutionData(blueprintId);
  const issues: { name: string }[] = [];
  if (exec.gamingFlags > 0) issues.push({ name: "Gaming-flagged feedback requires review" });
  if (failures.length > 0) issues.push({ name: `${failures.length} classified failure(s) on record` });
  if (exec.feedbackRate < 0.6) issues.push({ name: "Feedback compliance below 60% policy threshold" });

  const score = Math.max(0, 1 - issues.length * 0.15 - exec.gamingFlags * 0.05);
  return {
    issues,
    score: Math.round(score * 100) / 100,
    riskScore: Math.round((1 - score) * 100) / 100,
  };
}
