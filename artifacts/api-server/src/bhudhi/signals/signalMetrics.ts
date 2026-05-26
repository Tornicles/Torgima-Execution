/**
 * Derive signal metrics from execution data (orders, feedback, events, snapshots).
 */
import {
  db,
  orders,
  feedback,
  bhudhiExecutionEvents,
  signalSnapshots,
  blueprints,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SignalMetrics } from "./types.js";

export async function getMetrics(blueprintId: string): Promise<SignalMetrics> {
  const events = await db
    .select()
    .from(bhudhiExecutionEvents)
    .where(eq(bhudhiExecutionEvents.blueprint_id, blueprintId))
    .orderBy(desc(bhudhiExecutionEvents.created_at))
    .limit(50);

  const [orderStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${orders.status} = 'completed')::int`,
    })
    .from(orders)
    .where(eq(orders.blueprint_id, blueprintId));

  const [fbStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      avgFriction: sql<number>`coalesce(avg(${feedback.friction_score}), 0)`,
      gaming: sql<number>`count(*) filter (where ${feedback.gaming_flag} = true)::int`,
    })
    .from(feedback)
    .where(eq(feedback.blueprint_id, blueprintId));

  const [signal] = await db
    .select()
    .from(signalSnapshots)
    .where(and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)))
    .limit(1);

  const [bp] = await db
    .select({ intel_metadata: blueprints.intel_metadata, created_at: blueprints.created_at })
    .from(blueprints)
    .where(eq(blueprints.id, blueprintId))
    .limit(1);

  const totalOrders = Number(orderStats?.total ?? 0);
  const completedOrders = Number(orderStats?.completed ?? 0);
  const orderCompletionRate = totalOrders > 0 ? completedOrders / totalOrders : 0;

  const completedEvents = events.filter((e) => e.event_type === "task_completed");
  const eventCompletionRate =
    events.length > 0 ? completedEvents.length / events.length : orderCompletionRate;

  const completionRate = totalOrders > 0 ? orderCompletionRate : eventCompletionRate;

  const recentEvents = events.slice(0, 10);
  const olderEvents = events.slice(10, 20);
  const recentCompletion =
    recentEvents.filter((e) => e.event_type === "task_completed").length /
    Math.max(recentEvents.length, 1);
  const olderCompletion =
    olderEvents.filter((e) => e.event_type === "task_completed").length /
    Math.max(olderEvents.length, 1);

  let momentum = recentCompletion - olderCompletion;
  if (events.length < 5 && signal?.momentum != null) {
    momentum = signal.momentum / 100;
  }

  let trend: SignalMetrics["trend"] = "stable";
  if (momentum > 0.1) trend = "improving";
  else if (momentum < -0.1) trend = "declining";
  else if (signal?.trend) {
    const t = String(signal.trend);
    if (t === "improving" || t === "declining" || t === "stable") trend = t;
  }

  const feedbackCount = Number(fbStats?.total ?? 0);
  const gamingFlags = Number(fbStats?.gaming ?? 0);
  const feedbackRate = totalOrders > 0 ? feedbackCount / totalOrders : 0;
  const avgFriction = Number(fbStats?.avgFriction ?? 0);

  const daysActive = bp?.created_at
    ? Math.max(1, (Date.now() - bp.created_at.getTime()) / (1000 * 60 * 60 * 24))
    : 1;
  const throughput = Math.round((totalOrders / daysActive) * 10) / 10;

  const meta = (bp?.intel_metadata ?? {}) as Record<string, unknown>;
  const revenue = typeof meta["revenue"] === "number" ? meta["revenue"] : 0;
  const burnRate = typeof meta["burnRate"] === "number" ? meta["burnRate"] : 0;
  const runway = burnRate > 0 ? Math.round((revenue / burnRate) * 10) / 10 : 12;

  const weightedScore = signal?.weighted_score ?? completionRate;
  const clarity = Math.min(1, weightedScore * 0.6 + (signal?.completion_rate ?? completionRate) * 0.4);

  return {
    completionRate,
    momentum: Math.round(momentum * 100) / 100,
    trend,
    confidenceLevel: Math.min(events.length / 50, 1),
    confidence: Math.min((events.length + totalOrders) / 50, 1),
    clarity,
    demandTrend: momentum > 0 ? 0.2 : momentum < 0 ? -0.2 : 0,
    satisfactionScore: Math.max(0, Math.min(1, 1 - avgFriction)),
    throughput,
    targetThroughput: 15,
    burnRate,
    revenue,
    runway,
    capabilityScore: Math.min(1, completionRate + feedbackRate * 0.2),
    morale: Math.max(0, Math.min(1, 1 - avgFriction - gamingFlags * 0.05)),
    confusionLevel: Math.min(1, gamingFlags * 0.1 + (1 - feedbackRate) * 0.3),
    riskScore: Math.min(1, gamingFlags * 0.15 + (1 - completionRate) * 0.4),
    learningVelocity: Math.min(1, feedbackRate * 0.8),
    decisionSpeed: Math.min(1, completionRate * 0.7 + (1 - avgFriction) * 0.3),
    adaptabilityScore: Math.min(1, Math.abs(momentum) + completionRate * 0.3),
    renewalCapacity: Math.min(1, 1 - gamingFlags * 0.1),
    weightedScore,
    feedbackRate,
    gamingRate: feedbackCount > 0 ? gamingFlags / feedbackCount : 0,
  };
}
