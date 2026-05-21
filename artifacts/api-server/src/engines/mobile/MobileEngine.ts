/**
 * PROMPT 6 — Mobile widget data, device tokens, batch sync, health metrics.
 */
import {
  db,
  mobileDeviceTokens,
  mobileHealthMetrics,
  mobileSyncLog,
  mobileWearableConnections,
  inAppNotifications,
  blueprints,
  userStreaks,
  principleSelections,
  principles,
} from "@workspace/db";
import { and, desc, eq, isNull, count } from "drizzle-orm";
import { ExecutionLoopService } from "../../services/ExecutionLoopService.js";
import { runPrimaryLoop } from "../execution-loop/runPrimaryLoop.js";
import { getGamificationProfile } from "../gamification/GamificationEngine.js";
import { getTodaySchedule } from "../calendar/CalendarEngine.js";

export async function registerDeviceToken(params: {
  userId: string;
  pushToken: string;
  platform: string;
  deviceId?: string;
  appVersion?: string;
}) {
  const [row] = await db
    .insert(mobileDeviceTokens)
    .values({
      user_id: params.userId,
      push_token: params.pushToken,
      platform: params.platform,
      device_id: params.deviceId,
      app_version: params.appVersion,
      is_active: true,
      last_seen_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [mobileDeviceTokens.user_id, mobileDeviceTokens.push_token],
      set: {
        is_active: true,
        platform: params.platform,
        device_id: params.deviceId,
        app_version: params.appVersion,
        last_seen_at: new Date(),
        updated_at: new Date(),
      },
    })
    .returning();
  return row;
}

export async function getWidgetData(userId: string) {
  const [profile, streaks, active, todayCalendar, unread] = await Promise.all([
    getGamificationProfile(userId).catch(() => null),
    db.select().from(userStreaks).where(eq(userStreaks.user_id, userId)),
    ExecutionLoopService.getActiveOrder(userId).catch(() => null),
    getTodaySchedule(userId).catch(() => [] as unknown[]),
    db
      .select({ c: count() })
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.user_id, userId), isNull(inAppNotifications.read_at))),
  ]);

  const order = active?.order;
  const todayTask = order
    ? {
        id: order.id,
        title: order.title ?? order.task_type ?? "Today's order",
        priority: order.priority ?? 3,
        dueTime: order.due_at ? new Date(order.due_at).toLocaleTimeString() : null,
        status: order.status,
      }
    : null;

  const [todayPrinciple] = await db
    .select({
      principleId: principleSelections.principle_id,
      title: principles.principle_statement,
    })
    .from(principleSelections)
    .innerJoin(principles, eq(principles.id, principleSelections.principle_id))
    .where(eq(principleSelections.user_id, userId))
    .orderBy(desc(principleSelections.selected_date))
    .limit(1);

  const streakMap = {
    execution: streaks.find((s) => s.streak_type === "execution")?.current_count ?? 0,
    principles: streaks.find((s) => s.streak_type === "principles")?.current_count ?? 0,
    content: streaks.find((s) => s.streak_type === "content")?.current_count ?? 0,
  };

  return {
    todayTask,
    todayPrinciple: todayPrinciple
      ? { id: todayPrinciple.principleId, title: todayPrinciple.title }
      : null,
    currentStreak: streakMap,
    userLevel: profile?.currentLevel ?? 1,
    userXP: profile?.totalXP ?? 0,
    avatarColor:
      (profile?.avatar as { color?: string } | null)?.color ??
      (profile?.avatarCustomization as { color?: string })?.color ??
      "violet",
    unreadNotifications: Number(unread[0]?.c ?? 0),
    calendarEventCount: Array.isArray(todayCalendar) ? todayCalendar.length : 0,
    badgeCount: Number(unread[0]?.c ?? 0) + (todayTask && order?.status === "active" ? 1 : 0),
  };
}

export async function getMobileDashboardSummary(userId: string) {
  const widget = await getWidgetData(userId);
  const [bp] = await db
    .select({ id: blueprints.id, goal: blueprints.goal })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);

  return {
    ...widget,
    activeBlueprintId: bp?.id ?? null,
    activeBlueprintTitle: bp?.goal ?? null,
  };
}

export async function submitQuickFeedback(params: {
  userId: string;
  orderId: string;
  blueprintId: string;
  status: "completed" | "partial" | "failed" | "skipped";
  score?: number;
  reflection?: string;
  idempotencyKey?: string;
}) {
  const score =
    params.score ??
    (params.status === "completed" ? 8 : params.status === "partial" ? 5 : params.status === "failed" ? 2 : 4);

  return runPrimaryLoop(params.userId, {
    userId: params.userId,
    blueprintId: params.blueprintId,
    orderId: params.orderId,
    completionStatus: params.status,
    feedbackText: params.reflection,
    score,
    idempotencyKey: params.idempotencyKey ?? `mobile-quick-${params.orderId}-${Date.now()}`,
  });
}

export type MobileSyncAction = {
  clientActionId: string;
  type: "create" | "update" | "delete";
  resource: string;
  payload: Record<string, unknown>;
};

export function resolveSyncConflict(
  resource: string,
): "local-wins" | "remote-wins" {
  if (resource === "feedback" || resource === "execution/feedback") return "local-wins";
  return "remote-wins";
}

export async function processBatchSync(userId: string, actions: MobileSyncAction[]) {
  const results: Array<{
    clientActionId: string;
    status: "applied" | "skipped" | "failed";
    error?: string;
  }> = [];

  for (const action of actions) {
    const [existing] = await db
      .select()
      .from(mobileSyncLog)
      .where(
        and(
          eq(mobileSyncLog.user_id, userId),
          eq(mobileSyncLog.client_action_id, action.clientActionId),
        ),
      )
      .limit(1);

    if (existing?.status === "applied") {
      results.push({ clientActionId: action.clientActionId, status: "skipped" });
      continue;
    }

    try {
      if (action.resource === "feedback" || action.resource === "execution/feedback") {
        const p = action.payload;
        await submitQuickFeedback({
          userId,
          orderId: String(p.orderId),
          blueprintId: String(p.blueprintId),
          status: p.completionStatus as "completed" | "partial" | "failed" | "skipped",
          score: typeof p.score === "number" ? p.score : undefined,
          reflection: typeof p.feedbackText === "string" ? p.feedbackText : undefined,
          idempotencyKey: action.clientActionId,
        });
      } else if (action.resource === "health-metrics") {
        await upsertHealthMetrics(userId, action.payload);
      } else if (action.resource === "chat/messages") {
        const p = action.payload;
        const { createPersonalMessage } = await import("../chat/PersonalChatEngine.js");
        await createPersonalMessage({
          userId,
          messageType: (p.messageType as "text") ?? "text",
          content: typeof p.content === "string" ? p.content : undefined,
        });
      }

      await db
        .insert(mobileSyncLog)
        .values({
          user_id: userId,
          client_action_id: action.clientActionId,
          resource: action.resource,
          action_type: action.type,
          status: "applied",
        })
        .onConflictDoUpdate({
          target: [mobileSyncLog.user_id, mobileSyncLog.client_action_id],
          set: { status: "applied", applied_at: new Date() },
        });

      results.push({ clientActionId: action.clientActionId, status: "applied" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      await db
        .insert(mobileSyncLog)
        .values({
          user_id: userId,
          client_action_id: action.clientActionId,
          resource: action.resource,
          action_type: action.type,
          status: "failed",
          error_message: msg,
        })
        .onConflictDoNothing();
      results.push({ clientActionId: action.clientActionId, status: "failed", error: msg });
    }
  }

  return { results, conflictPolicy: resolveSyncConflict("feedback") };
}

async function upsertHealthMetrics(userId: string, payload: Record<string, unknown>) {
  const dateStr =
    typeof payload.metricDate === "string"
      ? payload.metricDate
      : new Date().toISOString().slice(0, 10);
  const source = typeof payload.source === "string" ? payload.source : "apple-health";

  await db
    .insert(mobileHealthMetrics)
    .values({
      user_id: userId,
      metric_date: dateStr,
      steps: typeof payload.steps === "number" ? payload.steps : null,
      active_minutes: typeof payload.activeMinutes === "number" ? payload.activeMinutes : null,
      calories_burned: typeof payload.caloriesBurned === "number" ? payload.caloriesBurned : null,
      heart_rate_avg: typeof payload.heartRate === "number" ? payload.heartRate : null,
      sleep_hours: typeof payload.sleepHours === "number" ? payload.sleepHours : null,
      source,
      raw_payload: payload,
      synced_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [mobileHealthMetrics.user_id, mobileHealthMetrics.metric_date, mobileHealthMetrics.source],
      set: {
        steps: typeof payload.steps === "number" ? payload.steps : null,
        active_minutes: typeof payload.activeMinutes === "number" ? payload.activeMinutes : null,
        raw_payload: payload,
        synced_at: new Date(),
      },
    });
}

export async function saveHealthMetrics(
  userId: string,
  metrics: Record<string, unknown> & { source?: string },
) {
  return upsertHealthMetrics(userId, metrics);
}

export async function connectWearableProvider(
  userId: string,
  provider: string,
  oauthToken?: string,
) {
  const [row] = await db
    .insert(mobileWearableConnections)
    .values({
      user_id: userId,
      provider,
      oauth_token_encrypted: oauthToken,
      is_connected: Boolean(oauthToken),
      connected_at: oauthToken ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [mobileWearableConnections.user_id, mobileWearableConnections.provider],
      set: {
        oauth_token_encrypted: oauthToken,
        is_connected: Boolean(oauthToken),
        connected_at: oauthToken ? new Date() : null,
        updated_at: new Date(),
      },
    })
    .returning();
  return row;
}
