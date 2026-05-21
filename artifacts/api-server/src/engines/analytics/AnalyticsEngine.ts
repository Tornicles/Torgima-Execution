/**
 * PROMPT 7 — Analytics: execution, principles, academy, content, dashboards, export.
 */
import {
  db,
  feedback,
  orders,
  conditions,
  principleApplications,
  publishedContent,
  principles,
  academyStudentEnrollments,
  userStreaks,
  executionAnalytics,
  executionPatterns,
  failureAnalysis,
  productivityHeatmap,
  executionBenchmarks,
  principleEffectiveness,
  principleInsights,
  academyAnalytics,
  learningVelocityAnalytics,
  weakAreasDetected,
  contentAnalytics,
  platformPerformance,
  postPerformance,
  contentInsights,
  analyticsInsights,
} from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

export type TimeWindow = "today" | "week" | "month" | "all-time";

export function resolveDateRange(
  timeWindow: TimeWindow,
  startDate?: string,
  endDate?: string,
): { start: Date; end: Date; startStr: string; endStr: string } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end);
  if (!startDate) {
    if (timeWindow === "today") start.setHours(0, 0, 0, 0);
    else if (timeWindow === "week") start.setDate(start.getDate() - 7);
    else if (timeWindow === "month") start.setDate(start.getDate() - 30);
    else start.setFullYear(2000);
  }
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
  };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function engagementTotal(eng: unknown): number {
  if (!eng || typeof eng !== "object") return 0;
  const o = eng as Record<string, unknown>;
  let t = 0;
  for (const v of Object.values(o)) {
    if (typeof v === "number") t += v;
    else if (v && typeof v === "object") {
      const m = v as Record<string, number>;
      t += (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.impressions ?? 0);
    }
  }
  return t;
}

export function viralityScore(engagement: number, reach: number): number {
  if (reach <= 0) return 0;
  const rate = (engagement / reach) * 100;
  return Math.min(100, Math.pow(rate, 1.5) / 10);
}

export async function computeDailyAnalytics(userId: string, dateStr?: string) {
  const metricDate = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(metricDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(metricDate);
  end.setHours(23, 59, 59, 999);

  const dayFeedback = await db
    .select({
      id: feedback.id,
      order_id: feedback.order_id,
      completion_status: feedback.completion_status,
      score: feedback.score,
      weighted_score: feedback.weighted_score,
      created_at: feedback.created_at,
      finished_at: orders.finished_at,
      due_at: orders.due_at,
    })
    .from(feedback)
    .innerJoin(orders, eq(orders.id, feedback.order_id))
    .where(
      and(
        eq(feedback.user_id, userId),
        gte(feedback.created_at, start),
        lte(feedback.created_at, end),
      ),
    );

  const completed = dayFeedback.filter((f) => f.completion_status === "completed");
  const partial = dayFeedback.filter((f) => f.completion_status === "partial");
  const failed = dayFeedback.filter((f) => f.completion_status === "failed");
  const skipped = dayFeedback.filter((f) => f.completion_status === "skipped");
  const total = dayFeedback.length;
  const completionRate = total ? (completed.length / total) * 100 : 0;
  const scores = dayFeedback.map((f) => f.weighted_score ?? f.score ?? 0).filter((s) => s > 0);

  let onTime = 0;
  let late = 0;
  for (const f of completed) {
    if (f.finished_at && f.due_at) {
      if (f.finished_at <= f.due_at) onTime++;
      else late++;
    }
  }

  const hourCounts: Record<number, number> = {};
  for (const f of completed) {
    const h = f.created_at.getHours();
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  }
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const momentum = await calculateMomentum(userId, metricDate);

  const [condRow] = await db
    .select({ condition: conditions.condition })
    .from(conditions)
    .where(and(eq(conditions.user_id, userId), eq(conditions.is_current, true)))
    .limit(1);

  const conditionDistribution: Record<string, number> = {};
  if (condRow?.condition) conditionDistribution[condRow.condition] = 100;

  await db
    .insert(executionAnalytics)
    .values({
      user_id: userId,
      metric_date: metricDate,
      total_orders_created: total,
      total_orders_completed: completed.length,
      completion_rate: completionRate,
      partial_completions: partial.length,
      failed_orders: failed.length,
      skipped_orders: skipped.length,
      average_order_score: avg(scores),
      execution_momentum: momentum,
      orders_completed_on_time: onTime,
      orders_completed_late: late,
      peak_productivity_hour: peakHour ? Number(peakHour) : null,
      condition_distribution: conditionDistribution,
    })
    .onConflictDoUpdate({
      target: [executionAnalytics.user_id, executionAnalytics.metric_date],
      set: {
        total_orders_created: total,
        total_orders_completed: completed.length,
        completion_rate: completionRate,
        execution_momentum: momentum,
      },
    });

  await updateHeatmap(userId, dayFeedback);
  await detectExecutionPatterns(userId);
  await analyzeFailures(userId, failed);
  await computePrincipleAnalytics(userId, metricDate);
  await computeAcademyAnalytics(userId, metricDate);
  await computeContentAnalytics(userId, start, end, metricDate);
  await updateBenchmarks(userId, completionRate, avg(scores));

  logger.info({ userId, metricDate }, "[Analytics] Daily snapshot computed");
}

async function calculateMomentum(userId: string, metricDate: string): Promise<number> {
  const end = new Date(metricDate);
  const start7 = new Date(end);
  start7.setDate(start7.getDate() - 7);
  const start30 = new Date(end);
  start30.setDate(start30.getDate() - 30);

  const recentRate = await avgCompletionRate(userId, start7, end);
  const historicalRate = await avgCompletionRate(userId, start30, end);
  return computeMomentumFromRates(recentRate, historicalRate);
}

/** Normalized momentum in [-1, 1] from 7d vs 30d completion rates. */
export function computeMomentumFromRates(recentRate: number, historicalRate: number): number {
  if (historicalRate === 0) return 0;
  return Math.max(-1, Math.min(1, (recentRate - historicalRate) / historicalRate));
}

async function avgCompletionRate(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await db
    .select({ completion_status: feedback.completion_status })
    .from(feedback)
    .where(
      and(
        eq(feedback.user_id, userId),
        gte(feedback.created_at, start),
        lte(feedback.created_at, end),
      ),
    );
  if (!rows.length) return 0;
  const completed = rows.filter((r) => r.completion_status === "completed").length;
  return (completed / rows.length) * 100;
}

async function updateHeatmap(
  userId: string,
  dayFeedback: Array<{ completion_status: string; created_at: Date; weighted_score?: number | null; score?: number | null }>,
) {
  const buckets: Record<string, { done: number; total: number; scores: number[] }> = {};
  for (const f of dayFeedback) {
    const key = `${f.created_at.getDay()}-${f.created_at.getHours()}`;
    buckets[key] ??= { done: 0, total: 0, scores: [] };
    buckets[key].total++;
    if (f.completion_status === "completed") buckets[key].done++;
    const s = f.weighted_score ?? f.score;
    if (s) buckets[key].scores.push(s);
  }
  for (const [key, b] of Object.entries(buckets)) {
    const [dow, hour] = key.split("-").map(Number);
    await db
      .insert(productivityHeatmap)
      .values({
        user_id: userId,
        day_of_week: dow,
        hour_of_day: hour,
        orders_completed: b.done,
        completion_rate: b.total ? (b.done / b.total) * 100 : 0,
        average_score: avg(b.scores),
      })
      .onConflictDoUpdate({
        target: [
          productivityHeatmap.user_id,
          productivityHeatmap.day_of_week,
          productivityHeatmap.hour_of_day,
        ],
        set: {
          orders_completed: sql`${productivityHeatmap.orders_completed} + ${b.done}`,
          completion_rate: b.total ? (b.done / b.total) * 100 : 0,
        },
      });
  }
}

async function detectExecutionPatterns(userId: string) {
  const heat = await db
    .select()
    .from(productivityHeatmap)
    .where(eq(productivityHeatmap.user_id, userId));

  const byDay: Record<number, number> = {};
  const byHour: Record<number, number> = {};
  for (const h of heat) {
    byDay[h.day_of_week] = (byDay[h.day_of_week] ?? 0) + h.orders_completed;
    byHour[h.hour_of_day] = (byHour[h.hour_of_day] ?? 0) + h.orders_completed;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  if (bestDay && bestDay[1] > 0) {
    await db.insert(executionPatterns).values({
      user_id: userId,
      pattern_type: "best-day-of-week",
      pattern_description: `Most productive on ${dayNames[Number(bestDay[0])]}`,
      frequency: bestDay[1],
      impact: 0.3,
      actionable_insight: `Schedule important orders on ${dayNames[Number(bestDay[0])]}`,
    });
  }

  const bestHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  if (bestHour && bestHour[1] > 0) {
    await db.insert(executionPatterns).values({
      user_id: userId,
      pattern_type: "best-hour",
      pattern_description: `Most productive around ${bestHour[0]}:00`,
      frequency: bestHour[1],
      impact: 0.2,
      actionable_insight: `Protect ${bestHour[0]}:00 for deep execution`,
    });
  }
}

async function analyzeFailures(
  userId: string,
  failed: Array<{ order_id: string; id: string }>,
) {
  for (const f of failed.slice(0, 10)) {
    await db.insert(failureAnalysis).values({
      user_id: userId,
      failed_order_id: f.order_id,
      failure_reason: "Task marked failed in feedback",
      failure_category: "execution",
      severity: 3,
      suggested_prevention: "Break the order into smaller proof-backed steps",
    });
  }
}

async function computePrincipleAnalytics(userId: string, metricDate: string) {
  const [app] = await db
    .select()
    .from(principleApplications)
    .where(
      and(
        eq(principleApplications.user_id, userId),
        eq(principleApplications.principle_date, metricDate),
      ),
    )
    .limit(1);

  const [streak] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, "principles")))
    .limit(1);

  if (app?.principle_id) {
    await computePrincipleEffectiveness(userId, app.principle_id);
  }
}

async function computePrincipleEffectiveness(userId: string, principleId: string) {
  const apps = await db
    .select({ principle_date: principleApplications.principle_date })
    .from(principleApplications)
    .where(
      and(
        eq(principleApplications.user_id, userId),
        eq(principleApplications.principle_id, principleId),
      ),
    );

  const appliedDates = new Set(apps.map((a) => a.principle_date));
  const scoreOnApplied = await avgScoreOnDates(userId, [...appliedDates]);
  const scoreOffApplied = await avgScoreOffDates(userId, appliedDates);

  const diff = scoreOnApplied - scoreOffApplied;
  const effectivenessScore = Math.max(0, Math.min(100, 50 + diff * 5));

  await db
    .insert(principleEffectiveness)
    .values({
      user_id: userId,
      principle_id: principleId,
      effectiveness_score: effectivenessScore,
      application_count: appliedDates.size,
      average_order_score_when_applied: scoreOnApplied,
      average_order_score_when_not_applied: scoreOffApplied,
      correlation_strength: Math.min(1, Math.abs(diff) / 10),
      trend: diff > 1 ? "improving" : diff < -1 ? "declining" : "stable",
    })
    .onConflictDoUpdate({
      target: [principleEffectiveness.user_id, principleEffectiveness.principle_id],
      set: {
        effectiveness_score: effectivenessScore,
        application_count: appliedDates.size,
        last_evaluated_at: new Date(),
      },
    });
}

async function avgScoreOnDates(userId: string, dates: string[]): Promise<number> {
  if (!dates.length) return 0;
  const rows = await db
    .select({ score: feedback.score, weighted_score: feedback.weighted_score, created_at: feedback.created_at })
    .from(feedback)
    .where(eq(feedback.user_id, userId));
  const dateSet = new Set(dates);
  const scores = rows
    .filter((r) => dateSet.has(r.created_at.toISOString().slice(0, 10)))
    .map((r) => r.weighted_score ?? r.score ?? 0)
    .filter((s) => s > 0);
  return avg(scores);
}

async function avgScoreOffDates(userId: string, appliedDates: Set<string>): Promise<number> {
  const rows = await db
    .select({ score: feedback.score, weighted_score: feedback.weighted_score, created_at: feedback.created_at })
    .from(feedback)
    .where(eq(feedback.user_id, userId));
  const scores = rows
    .filter((r) => !appliedDates.has(r.created_at.toISOString().slice(0, 10)))
    .map((r) => r.weighted_score ?? r.score ?? 0)
    .filter((s) => s > 0);
  return avg(scores);
}

async function computeAcademyAnalytics(userId: string, metricDate: string) {
  const enrollments = await db
    .select()
    .from(academyStudentEnrollments)
    .where(eq(academyStudentEnrollments.user_id, userId));

  const inProgress = enrollments.filter((e) => e.status === "in-progress").length;
  const completed = enrollments.filter((e) => e.status === "completed").length;

  await db
    .insert(academyAnalytics)
    .values({
      user_id: userId,
      metric_date: metricDate,
      courses_in_progress: inProgress,
      courses_completed: completed,
      lessons_completed: completed,
      concepts_mastered: Math.floor(completed * 3),
      concepts_weak: inProgress > 0 ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [academyAnalytics.user_id, academyAnalytics.metric_date],
      set: { courses_in_progress: inProgress, courses_completed: completed },
    });
}

async function computeContentAnalytics(
  userId: string,
  start: Date,
  end: Date,
  metricDate: string,
) {
  const posts = await db
    .select()
    .from(publishedContent)
    .where(
      and(
        eq(publishedContent.user_id, userId),
        gte(publishedContent.published_at, start),
        lte(publishedContent.published_at, end),
      ),
    );

  let totalEng = 0;
  let bestId: string | null = null;
  let bestEng = 0;
  const byPlatform: Record<string, typeof posts> = {};

  for (const p of posts) {
    const eng = engagementTotal(p.engagement);
    totalEng += eng;
    if (eng > bestEng) {
      bestEng = eng;
      bestId = p.id;
    }
    const platforms = (p.platforms_posted as string[]) ?? ["unknown"];
    for (const pl of platforms) {
      byPlatform[pl] ??= [];
      byPlatform[pl].push(p);
    }

    for (const pl of platforms) {
      const reach = Math.max(eng, 10);
      await db
        .insert(postPerformance)
        .values({
          user_id: userId,
          principle_id: p.principle_id,
          post_id: p.id,
          platform: pl,
          content_summary: p.content_text.slice(0, 120),
          published_at: p.published_at,
          likes: eng,
          reach,
          impressions: reach * 2,
          engagement_rate: reach ? eng / reach : 0,
          virality_score: viralityScore(eng, reach),
        })
        .onConflictDoUpdate({
          target: [postPerformance.user_id, postPerformance.post_id, postPerformance.platform],
          set: { likes: eng, virality_score: viralityScore(eng, reach), updated_at: new Date() },
        });
    }
  }

  let bestPlatform: string | null = null;
  let bestPlatformEng = 0;
  for (const [pl, plPosts] of Object.entries(byPlatform)) {
    const pe = plPosts.reduce((s, p) => s + engagementTotal(p.engagement), 0);
    await db
      .insert(platformPerformance)
      .values({
        user_id: userId,
        platform: pl,
        metric_date: metricDate,
        posts_published: plPosts.length,
        total_engagement: pe,
        total_reach: pe * 2,
        top_post_engagement: Math.max(...plPosts.map((p) => engagementTotal(p.engagement)), 0),
        average_engagement_rate: plPosts.length ? pe / plPosts.length : 0,
      })
      .onConflictDoUpdate({
        target: [
          platformPerformance.user_id,
          platformPerformance.platform,
          platformPerformance.metric_date,
        ],
        set: { total_engagement: pe, posts_published: plPosts.length },
      });
    if (pe > bestPlatformEng) {
      bestPlatformEng = pe;
      bestPlatform = pl;
    }
  }

  await db
    .insert(contentAnalytics)
    .values({
      user_id: userId,
      metric_date: metricDate,
      posts_published: posts.length,
      total_engagement: totalEng,
      average_engagement_per_post: posts.length ? totalEng / posts.length : 0,
      best_performing_content_id: bestId,
      best_performing_platform: bestPlatform,
    })
    .onConflictDoUpdate({
      target: [contentAnalytics.user_id, contentAnalytics.metric_date],
      set: {
        posts_published: posts.length,
        total_engagement: totalEng,
      },
    });
}

async function updateBenchmarks(userId: string, completionRate: number, avgScore: number) {
  for (const [name, val] of [
    ["daily_completion_rate", completionRate],
    ["avg_order_score", avgScore],
  ] as const) {
    const [existing] = await db
      .select()
      .from(executionBenchmarks)
      .where(
        and(
          eq(executionBenchmarks.user_id, userId),
          eq(executionBenchmarks.metric_name, name),
        ),
      )
      .limit(1);

    const best = Math.max(existing?.personal_best ?? val, val);
    const worst = Math.min(existing?.personal_worst ?? val, val);

    await db
      .insert(executionBenchmarks)
      .values({
        user_id: userId,
        metric_name: name,
        current_value: val,
        personal_best: best,
        personal_worst: worst,
        average_value: val,
        trend: val > (existing?.current_value ?? 0) ? "improving" : "stable",
      })
      .onConflictDoUpdate({
        target: [executionBenchmarks.user_id, executionBenchmarks.metric_name],
        set: { current_value: val, personal_best: best, personal_worst: worst },
      });
  }
}

export async function getExecutionAnalyticsRange(
  userId: string,
  startStr: string,
  endStr: string,
) {
  return db
    .select()
    .from(executionAnalytics)
    .where(
      and(
        eq(executionAnalytics.user_id, userId),
        gte(executionAnalytics.metric_date, startStr),
        lte(executionAnalytics.metric_date, endStr),
      ),
    )
    .orderBy(executionAnalytics.metric_date);
}

export async function getExecutionDashboard(userId: string, timeWindow: TimeWindow) {
  const { startStr, endStr } = resolveDateRange(timeWindow);
  await computeDailyAnalytics(userId, endStr);

  const series = await getExecutionAnalyticsRange(userId, startStr, endStr);
  const latest = series[series.length - 1];
  const patterns = await db
    .select()
    .from(executionPatterns)
    .where(eq(executionPatterns.user_id, userId))
    .orderBy(desc(executionPatterns.detected_at))
    .limit(5);
  const failures = await db
    .select()
    .from(failureAnalysis)
    .where(eq(failureAnalysis.user_id, userId))
    .orderBy(desc(failureAnalysis.analyzed_at))
    .limit(10);
  const heatmap = await db
    .select()
    .from(productivityHeatmap)
    .where(eq(productivityHeatmap.user_id, userId));
  const benchmarks = await db
    .select()
    .from(executionBenchmarks)
    .where(eq(executionBenchmarks.user_id, userId));

  const [streak] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, "execution")))
    .limit(1);

  return {
    timeWindow,
    completionRate: latest?.completion_rate ?? 0,
    executionMomentum: latest?.execution_momentum ?? 0,
    averageOrderScore: latest?.average_order_score ?? 0,
    currentStreak: streak?.current_count ?? 0,
    completionTrend: series.map((s) => ({
      date: s.metric_date,
      value: s.completion_rate,
    })),
    conditionDistribution: latest?.condition_distribution ?? {},
    productivityHeatmap: heatmap,
    topPatterns: patterns,
    recentFailures: failures,
    benchmarks,
    recommendations: patterns.map((p) => p.actionable_insight).filter(Boolean),
  };
}

export async function getPrinciplesDashboard(userId: string, timeWindow: TimeWindow) {
  const { startStr, endStr } = resolveDateRange(timeWindow);
  const effectiveness = await db
    .select({
      principleId: principleEffectiveness.principle_id,
      score: principleEffectiveness.effectiveness_score,
      applications: principleEffectiveness.application_count,
      trend: principleEffectiveness.trend,
      statement: principles.principle_statement,
    })
    .from(principleEffectiveness)
    .innerJoin(principles, eq(principles.id, principleEffectiveness.principle_id))
    .where(eq(principleEffectiveness.user_id, userId))
    .orderBy(desc(principleEffectiveness.effectiveness_score));

  const [streak] = await db
    .select()
    .from(userStreaks)
    .where(and(eq(userStreaks.user_id, userId), eq(userStreaks.streak_type, "principles")))
    .limit(1);

  const insights = await db
    .select()
    .from(principleInsights)
    .where(eq(principleInsights.user_id, userId))
    .limit(10);

  return {
    timeWindow,
    currentStreak: streak?.current_count ?? 0,
    bestStreak: streak?.best_count ?? 0,
    principleEffectiveness: effectiveness,
    mostEffectivePrinciples: effectiveness.slice(0, 5).map((e) => e.statement),
    leastEffectivePrinciples: [...effectiveness].reverse().slice(0, 3).map((e) => e.statement),
    insights,
    recommendations: insights.map((i) => i.actionable_recommendation).filter(Boolean),
  };
}

export async function getAcademyDashboard(userId: string, timeWindow: TimeWindow) {
  const { startStr, endStr } = resolveDateRange(timeWindow);
  const series = await db
    .select()
    .from(academyAnalytics)
    .where(
      and(
        eq(academyAnalytics.user_id, userId),
        gte(academyAnalytics.metric_date, startStr),
        lte(academyAnalytics.metric_date, endStr),
      ),
    );

  const weak = await db
    .select()
    .from(weakAreasDetected)
    .where(eq(weakAreasDetected.user_id, userId))
    .limit(20);

  const velocity = await db
    .select()
    .from(learningVelocityAnalytics)
    .where(eq(learningVelocityAnalytics.user_id, userId))
    .orderBy(desc(learningVelocityAnalytics.created_at))
    .limit(1);

  return {
    timeWindow,
    series,
    weakAreas: weak,
    velocity: velocity[0] ?? null,
    recommendations: weak.map((w) => w.recommended_action).filter(Boolean),
  };
}

export async function getContentDashboard(userId: string, timeWindow: TimeWindow) {
  const { startStr, endStr } = resolveDateRange(timeWindow);
  const series = await db
    .select()
    .from(contentAnalytics)
    .where(
      and(
        eq(contentAnalytics.user_id, userId),
        gte(contentAnalytics.metric_date, startStr),
        lte(contentAnalytics.metric_date, endStr),
      ),
    );

  const platforms = await db
    .select()
    .from(platformPerformance)
    .where(
      and(
        eq(platformPerformance.user_id, userId),
        gte(platformPerformance.metric_date, startStr),
        lte(platformPerformance.metric_date, endStr),
      ),
    );

  const posts = await db
    .select()
    .from(postPerformance)
    .where(eq(postPerformance.user_id, userId))
    .orderBy(desc(postPerformance.likes))
    .limit(50);

  const insights = await db
    .select()
    .from(contentInsights)
    .where(eq(contentInsights.user_id, userId))
    .limit(10);

  return {
    timeWindow,
    series,
    byPlatform: platforms,
    topPosts: posts,
    insights,
    recommendations: insights.map((i) => i.actionable_recommendation).filter(Boolean),
  };
}

export async function getIntegratedDashboard(userId: string) {
  const exec = await getExecutionDashboard(userId, "month");
  const prin = await getPrinciplesDashboard(userId, "month");
  const acad = await getAcademyDashboard(userId, "month");
  const cont = await getContentDashboard(userId, "month");

  const executionScore = Math.min(100, exec.completionRate);
  const principleScore = Math.min(
    100,
    avg(prin.principleEffectiveness.map((p) => p.score ?? 50)),
  );
  const learningScore = Math.min(100, (acad.series.at(-1)?.courses_completed ?? 0) * 10);
  const contentScore = Math.min(
    100,
    avg(cont.series.map((s) => s.average_engagement_per_post ?? 0)) * 2,
  );
  const overallScore = Math.round(
    (executionScore + principleScore + learningScore + contentScore) / 4,
  );

  return {
    executionScore,
    principleScore,
    learningScore,
    contentScore,
    overallScore,
    topPriorities: [
      exec.completionRate < 60 ? "Raise completion rate with smaller orders" : null,
      prin.currentStreak < 3 ? "Rebuild principles streak" : null,
      cont.series.length === 0 ? "Publish principle-backed content" : null,
    ].filter(Boolean),
    opportunities: exec.recommendations.slice(0, 3),
  };
}

export async function generateAnalyticsInsights(userId: string): Promise<string[]> {
  const integrated = await getIntegratedDashboard(userId);
  const insights = [
    `Overall execution score: ${integrated.overallScore}/100`,
    ...integrated.topPriorities,
    ...integrated.opportunities,
  ].filter(Boolean) as string[];

  await db.insert(analyticsInsights).values({
    user_id: userId,
    domain: "integrated",
    insights,
  });

  return insights;
}

export async function exportAnalyticsData(
  userId: string,
  startStr: string,
  endStr: string,
) {
  return {
    execution: await getExecutionAnalyticsRange(userId, startStr, endStr),
    principles: await db
      .select()
      .from(principleEffectiveness)
      .where(eq(principleEffectiveness.user_id, userId)),
    academy: await db
      .select()
      .from(academyAnalytics)
      .where(
        and(
          eq(academyAnalytics.user_id, userId),
          gte(academyAnalytics.metric_date, startStr),
          lte(academyAnalytics.metric_date, endStr),
        ),
      ),
    content: await db
      .select()
      .from(contentAnalytics)
      .where(
        and(
          eq(contentAnalytics.user_id, userId),
          gte(contentAnalytics.metric_date, startStr),
          lte(contentAnalytics.metric_date, endStr),
        ),
      ),
    generatedAt: new Date().toISOString(),
    dateRange: { start: startStr, end: endStr },
  };
}

export function exportToCsv(data: Record<string, unknown>): string {
  const lines: string[] = ["section,key,value"];
  const walk = (section: string, obj: unknown, prefix = "") => {
    if (obj == null) return;
    if (Array.isArray(obj)) {
      lines.push(`${section},${prefix}count,${obj.length}`);
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(section, v, prefix ? `${prefix}.${k}` : k);
      }
      return;
    }
    lines.push(`${section},${prefix},${String(obj).replace(/,/g, ";")}`);
  };
  for (const [section, val] of Object.entries(data)) {
    walk(section, val);
  }
  return lines.join("\n");
}

export async function runDailyAnalyticsForActiveUsers() {
  const userRows = await db
    .selectDistinct({ user_id: feedback.user_id })
    .from(feedback)
    .where(gte(feedback.created_at, new Date(Date.now() - 90 * 86400000)));

  for (const row of userRows) {
    if (row.user_id) await computeDailyAnalytics(row.user_id);
  }
}
