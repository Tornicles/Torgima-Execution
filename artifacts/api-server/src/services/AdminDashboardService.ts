import {
  db,
  users,
  sessions,
  blueprints,
  orders,
  feedback,
  events,
  bhudhiLogs,
  adminSupportNotes,
  adminActionsLog,
  behaviorPatterns,
  signalSnapshots,
  personalMessages,
} from "@workspace/db";
import { pool } from "@workspace/db";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { collectProductionMetrics } from "./MonitoringMetricsService.js";
import { deadLetterQueue } from "./DeadLetterQueue.js";
import { getEventSystemHealth } from "./EventDispatcher.js";
import { DashboardService } from "./DashboardService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getAdminOverviewKpis() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [totalUsers] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  const [dau] = await db
    .select({ c: sql<number>`count(distinct ${sessions.user_id})::int` })
    .from(sessions)
    .where(gte(sessions.last_used_at, new Date(Date.now() - DAY_MS)));
  const [mau] = await db
    .select({ c: sql<number>`count(distinct ${sessions.user_id})::int` })
    .from(sessions)
    .where(gte(sessions.last_used_at, new Date(Date.now() - 30 * DAY_MS)));
  const [activeBlueprints] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")));
  const [tasksToday] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(eq(orders.status, "completed"), gte(orders.updated_at, today)));
  const [feedbackToday] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(feedback)
    .where(gte(feedback.created_at, today));

  return {
    totalUsers: totalUsers?.c ?? 0,
    dau: dau?.c ?? 0,
    mau: mau?.c ?? 0,
    activeBlueprints: activeBlueprints?.c ?? 0,
    tasksCompletedToday: tasksToday?.c ?? 0,
    feedbackSubmittedToday: feedbackToday?.c ?? 0,
    collectedAt: new Date().toISOString(),
  };
}

export async function getAdminSystemHealth() {
  const metrics = await collectProductionMetrics();
  const eventHealth = await getEventSystemHealth();

  let dbOk = true;
  try {
    await pool.query("SELECT 1");
  } catch {
    dbOk = false;
  }

  const lastBhudhiRows = await db
    .select({
      validationStatus: bhudhiLogs.validation_status,
      fallbackUsed: bhudhiLogs.fallback_used,
      createdAt: bhudhiLogs.created_at,
    })
    .from(bhudhiLogs)
    .orderBy(desc(bhudhiLogs.created_at))
    .limit(1);
  const lastBhudhi = lastBhudhiRows[0];

  const stuck = await pool.query<{ c: string }>(`
    SELECT COUNT(*)::int AS c FROM events
    WHERE status IN ('pending', 'retry_pending')
      AND process_after < NOW() - INTERVAL '5 minutes'
  `);

  return {
    apiStatus: "ok",
    database: dbOk ? "connected" : "error",
    workerQueueDepth: metrics.pending_event_count,
    deadLetterCount: metrics.dead_letter_count,
    bhudhiLastStatus:
      lastBhudhi?.validationStatus ?? (lastBhudhi?.fallbackUsed ? "fallback" : "unknown"),
    bhudhiLastAt: lastBhudhi?.createdAt?.toISOString() ?? null,
    stuckEvents: Number(stuck.rows[0]?.c ?? 0),
    eventHealth,
    metrics,
  };
}

export async function getAdminActivityFeed(limit = 20) {
  const rows = await db
    .select({
      id: events.id,
      eventType: events.event_type,
      userId: events.user_id,
      blueprintId: events.blueprint_id,
      status: events.status,
      createdAt: events.created_at,
    })
    .from(events)
    .orderBy(desc(events.created_at))
    .limit(limit);

  const signups = await db
    .select({ id: users.id, email: users.email, createdAt: users.created_at })
    .from(users)
    .orderBy(desc(users.created_at))
    .limit(5);

  return {
    events: rows.map((r) => ({
      id: r.id,
      type: r.eventType,
      userId: r.userId,
      blueprintId: r.blueprintId,
      status: r.status,
      at: r.createdAt.toISOString(),
    })),
    recentSignups: signups.map((s) => ({
      userId: s.id,
      email: s.email,
      at: s.createdAt.toISOString(),
    })),
  };
}

export async function getAdminConditionDistribution() {
  const rows = await db
    .select({
      condition: blueprints.current_condition,
      count: sql<number>`count(*)::int`,
    })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.status, "active")))
    .groupBy(blueprints.current_condition);

  return rows.map((r) => ({
    condition: r.condition ?? "unknown",
    count: r.count,
  }));
}

export async function getAdminSignupTrend(days = 7) {
  const since = new Date(Date.now() - days * DAY_MS);
  const result = await pool.query<{ day: string; count: string }>(`
    SELECT date_trunc('day', created_at)::date::text AS day, COUNT(*)::int AS count
    FROM users
    WHERE created_at >= $1
    GROUP BY 1
    ORDER BY 1
  `, [since]);
  return result.rows.map((r) => ({ day: r.day, count: Number(r.count) }));
}

export async function listAdminUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  tier?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (params.search?.trim()) {
    filters.push(ilike(users.email, `%${params.search.trim()}%`));
  }
  if (params.tier) {
    filters.push(eq(users.tier, params.tier as "starter" | "growth" | "ultimate"));
  }

  const where = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      tier: users.tier,
      createdAt: users.created_at,
      activeBlueprintId: users.active_blueprint_id,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.created_at))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .where(where);

  const enriched = await Promise.all(
    rows.map(async (u) => {
      const [lastSession] = await db
        .select({ lastUsed: sessions.last_used_at })
        .from(sessions)
        .where(eq(sessions.user_id, u.id))
        .orderBy(desc(sessions.last_used_at))
        .limit(1);

      let blueprintStatus = "none";
      let condition: string | null = null;
      let blueprintTier: string | null = null;
      if (u.activeBlueprintId) {
        const [bp] = await db
          .select({
            status: blueprints.status,
            condition: blueprints.current_condition,
            tier: blueprints.tier,
          })
          .from(blueprints)
          .where(eq(blueprints.id, u.activeBlueprintId))
          .limit(1);
        if (bp) {
          blueprintStatus = bp.status ?? "draft";
          condition = bp.condition;
          blueprintTier = bp.tier;
        }
      }

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const [tasksToday] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(orders)
        .where(
          and(
            eq(orders.user_id, u.id),
            eq(orders.status, "completed"),
            gte(orders.updated_at, today),
          ),
        );

      return {
        id: u.id,
        email: u.email,
        tier: blueprintTier ?? u.tier,
        signedUpAt: u.createdAt.toISOString(),
        lastActiveAt: lastSession?.lastUsed?.toISOString() ?? null,
        condition,
        tasksToday: tasksToday?.c ?? 0,
        blueprintStatus,
      };
    }),
  );

  return { users: enriched, page, pageSize, total: total ?? 0 };
}

export async function getAdminUserDetail(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [lastSession] = await db
    .select({ lastUsed: sessions.last_used_at })
    .from(sessions)
    .where(eq(sessions.user_id, userId))
    .orderBy(desc(sessions.last_used_at))
    .limit(1);

  const [bp] = user.active_blueprint_id
    ? await db.select().from(blueprints).where(eq(blueprints.id, user.active_blueprint_id)).limit(1)
    : [null];

  let dashboard = null;
  try {
    dashboard = await DashboardService.getDashboardState(userId);
  } catch {
    dashboard = null;
  }

  const recentEvents = await db
    .select({
      id: events.id,
      eventType: events.event_type,
      status: events.status,
      createdAt: events.created_at,
      payload: events.payload,
    })
    .from(events)
    .where(eq(events.user_id, userId))
    .orderBy(desc(events.created_at))
    .limit(20);

  const recentFeedback = await db
    .select({
      id: feedback.id,
      orderId: feedback.order_id,
      completionStatus: feedback.completion_status,
      score: feedback.score,
      createdAt: feedback.created_at,
    })
    .from(feedback)
    .where(eq(feedback.user_id, userId))
    .orderBy(desc(feedback.created_at))
    .limit(10);

  const patterns = await db
    .select()
    .from(behaviorPatterns)
    .where(and(eq(behaviorPatterns.user_id, userId), eq(behaviorPatterns.status, "active")))
    .limit(10);

  const bhudhiCalls = await db
    .select({
      id: bhudhiLogs.id,
      triggerType: bhudhiLogs.trigger_type,
      validationStatus: bhudhiLogs.validation_status,
      tokensIn: bhudhiLogs.token_count_in,
      tokensOut: bhudhiLogs.token_count_out,
      createdAt: bhudhiLogs.created_at,
    })
    .from(bhudhiLogs)
    .where(eq(bhudhiLogs.user_id, userId))
    .orderBy(desc(bhudhiLogs.created_at))
    .limit(10);

  const notes = await db
    .select()
    .from(adminSupportNotes)
    .where(eq(adminSupportNotes.user_id, userId))
    .orderBy(desc(adminSupportNotes.created_at));

  const signalHistory = bp
    ? await db
        .select({
          condition: signalSnapshots.condition,
          createdAt: signalSnapshots.created_at,
        })
        .from(signalSnapshots)
        .where(eq(signalSnapshots.blueprint_id, bp.id))
        .orderBy(desc(signalSnapshots.created_at))
        .limit(14)
    : [];

  const [activeOrder] = bp
    ? await db
        .select({
          id: orders.id,
          title: orders.title,
          instruction: orders.instruction,
          status: orders.status,
          createdAt: orders.created_at,
        })
        .from(orders)
        .where(and(eq(orders.blueprint_id, bp.id), inArray(orders.status, ["active", "pending"])))
        .orderBy(desc(orders.created_at))
        .limit(1)
    : [null];

  return {
    identity: {
      id: user.id,
      email: user.email,
      signedUpAt: user.created_at.toISOString(),
      lastActiveAt: lastSession?.lastUsed?.toISOString() ?? null,
      tier: user.tier,
      mode: user.mode,
    },
    blueprint: bp
      ? {
          id: bp.id,
          goal: bp.goal,
          status: bp.status,
          tier: bp.tier,
          mode: bp.mode,
          stateVersion: bp.state_version,
          condition: bp.current_condition,
          systemLocked: bp.system_locked,
          lockReason: bp.pause_reason,
          activatedAt: bp.selection_confirmed_at?.toISOString() ?? null,
        }
      : null,
    dashboard,
    currentTask: activeOrder,
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      type: e.eventType,
      status: e.status,
      at: e.createdAt.toISOString(),
      payloadSummary:
        typeof e.payload === "object" && e.payload
          ? JSON.stringify(e.payload).slice(0, 120)
          : "",
    })),
    recentFeedback,
    behaviorPatterns: patterns,
    bhudhiCalls,
    supportNotes: notes,
    signalHistory,
  };
}

export async function getAdminAnalyticsOverview(days = 30) {
  const since = new Date(Date.now() - days * DAY_MS);
  const [signups] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(gte(users.created_at, since));
  const [activated] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(blueprints)
    .where(
      and(
        eq(blueprints.status, "active"),
        gte(blueprints.selection_confirmed_at, since),
      ),
    );

  const completion = await pool.query<{ completed: string; generated: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*)::int AS generated
    FROM orders
    WHERE created_at >= $1
  `, [since]);

  const [dangerUsers] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(blueprints)
    .where(and(eq(blueprints.active, true), eq(blueprints.current_condition, "danger")));

  return {
    periodDays: days,
    signups: signups?.c ?? 0,
    blueprintActivations: activated?.c ?? 0,
    activationRate: signups?.c ? (activated?.c ?? 0) / signups.c : 0,
    tasksCompleted: Number(completion.rows[0]?.completed ?? 0),
    tasksGenerated: Number(completion.rows[0]?.generated ?? 0),
    taskCompletionRate:
      Number(completion.rows[0]?.generated ?? 0) > 0
        ? Number(completion.rows[0]?.completed ?? 0) / Number(completion.rows[0]?.generated ?? 0)
        : 0,
    usersInDanger: dangerUsers?.c ?? 0,
  };
}

export async function getAdminBhudhiUsage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [todayStats] = await db
    .select({
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(coalesce(${bhudhiLogs.token_count_in}, 0) + coalesce(${bhudhiLogs.token_count_out}, 0)), 0)::int`,
      success: sql<number>`count(*) filter (where ${bhudhiLogs.output_schema_valid} = true)::int`,
    })
    .from(bhudhiLogs)
    .where(gte(bhudhiLogs.created_at, today));

  const byTrigger = await db
    .select({
      trigger: bhudhiLogs.trigger_type,
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(coalesce(${bhudhiLogs.token_count_in}, 0) + coalesce(${bhudhiLogs.token_count_out}, 0)), 0)::int`,
    })
    .from(bhudhiLogs)
    .where(gte(bhudhiLogs.created_at, new Date(Date.now() - 30 * DAY_MS)))
    .groupBy(bhudhiLogs.trigger_type);

  const daily = await pool.query<{ day: string; calls: string; tokens: string }>(`
    SELECT date_trunc('day', created_at)::date::text AS day,
           COUNT(*)::int AS calls,
           COALESCE(SUM(tokens_used), 0)::int AS tokens
    FROM bhudhi_logs
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `);

  const failures = await db
    .select({
      id: bhudhiLogs.id,
      trigger: bhudhiLogs.trigger_type,
      validationStatus: bhudhiLogs.validation_status,
      userId: bhudhiLogs.user_id,
      createdAt: bhudhiLogs.created_at,
    })
    .from(bhudhiLogs)
    .where(
      and(
        gte(bhudhiLogs.created_at, today),
        or(eq(bhudhiLogs.output_schema_valid, false), eq(bhudhiLogs.fallback_used, true)),
      ),
    )
    .orderBy(desc(bhudhiLogs.created_at))
    .limit(20);

  const calls = todayStats?.calls ?? 0;
  const success = todayStats?.success ?? 0;

  return {
    today: {
      calls,
      tokens: todayStats?.tokens ?? 0,
      estimatedCostUsd: ((todayStats?.tokens ?? 0) / 1_000_000) * 3,
      successRate: calls > 0 ? success / calls : 1,
    },
    byTrigger,
    dailyTrend: daily.rows.map((r) => ({
      day: r.day,
      calls: Number(r.calls),
      tokens: Number(r.tokens),
    })),
    recentFailures: failures,
  };
}

export async function listAdminAuditLog(params: {
  page?: number;
  pageSize?: number;
  actionType?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, params.pageSize ?? 50);
  const offset = (page - 1) * pageSize;
  const where = params.actionType
    ? eq(adminActionsLog.action_type, params.actionType)
    : undefined;

  const rows = await db
    .select()
    .from(adminActionsLog)
    .where(where)
    .orderBy(desc(adminActionsLog.created_at))
    .limit(pageSize)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminActionsLog)
    .where(where);

  return { entries: rows, page, pageSize, total: total ?? 0 };
}

export async function listAdminDeadLetter() {
  const events = await deadLetterQueue.listUnresolved(100);
  return { events, count: events.length };
}

export async function addAdminSupportNote(params: {
  userId: string;
  note: string;
  adminEmail: string;
}) {
  const [row] = await db
    .insert(adminSupportNotes)
    .values({
      user_id: params.userId,
      note: params.note,
      admin_email: params.adminEmail,
    })
    .returning();
  return row;
}

export async function sendAdminSystemMessage(params: {
  userId: string;
  message: string;
}) {
  const [row] = await db
    .insert(personalMessages)
    .values({
      user_id: params.userId,
      message_type: "system_admin",
      content: params.message,
      tags: sql`'["admin"]'::jsonb`,
    })
    .returning({ id: personalMessages.id });
  return row;
}

export async function unlockUserBlueprint(userId: string) {
  const [bp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  if (!bp) return { unlocked: false };
  await db
    .update(blueprints)
    .set({ system_locked: false, pause_reason: null })
    .where(eq(blueprints.id, bp.id));
  return { unlocked: true, blueprintId: bp.id };
}
