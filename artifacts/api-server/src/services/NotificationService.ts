import crypto from "crypto";
import { db, users, notificationLogs, blueprints } from "@workspace/db";
import { eq, and, sql, gte, asc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { sendEmail, EMAIL_FROM } from "../lib/resend.js";
import {
  NOTIFICATION_TYPES,
  type NotificationType,
  FREQUENCY_CAP_HOURS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "../constants/notifications.js";
import {
  buildInactivityReminder,
  buildMilestoneAchieved,
  buildBlueprintCompleted,
  buildBlueprintPaused,
  buildPivotReviewReady,
  buildWeeklySummary,
  type NotificationContext,
  type EmailContent,
} from "./notification/EmailTemplates.js";

const APP_URL =
  process.env["PUBLIC_APP_URL"] ??
  process.env["NEXT_PUBLIC_APP_URL"] ??
  process.env["APP_URL"] ??
  "http://localhost:3000";

const UNSUBSCRIBE_SECRET = process.env["NOTIFICATION_UNSUBSCRIBE_SECRET"] ?? "dev-secret";

const FROM_HEADER = `Torgima <${EMAIL_FROM}>`;

export interface DeliveryPayloadSnapshot {
  notificationType: NotificationType;
  blueprintId?: string;
  sourceEventId?: string;
  contextData?: Partial<NotificationContext>;
  escalation?: boolean;
}

export interface SendNotificationParams {
  userId: string;
  notificationType: NotificationType;
  blueprintId?: string;
  sourceEventId?: string;
  contextData?: Partial<
    Omit<NotificationContext, "userId" | "unsubscribeUrl" | "preferencesUrl" | "unsubscribeAllUrl">
  >;
  escalation?: boolean;
}

export type SendNotificationResult = {
  sent: boolean;
  suppressed: boolean;
  suppressionReason?: string;
  logId?: string;
};

function buildUnsubscribeToken(userId: string, notificationType: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      notificationType,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 90 * 24 * 3600000,
    }),
  ).toString("base64url");

  const sig = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("base64url");

  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): {
  userId: string;
  notificationType: string;
  valid: boolean;
} {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return { userId: "", notificationType: "", valid: false };

    const expectedSig = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("base64url");

    if (sig !== expectedSig) return { userId: "", notificationType: "", valid: false };

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId: string;
      notificationType: string;
      expiresAt: number;
    };
    if (Date.now() > data.expiresAt) return { userId: "", notificationType: "", valid: false };

    return { userId: data.userId, notificationType: data.notificationType, valid: true };
  } catch {
    return { userId: "", notificationType: "", valid: false };
  }
}

function buildUnsubscribeUrls(userId: string, notificationType: string) {
  const token = buildUnsubscribeToken(userId, notificationType);
  const globalToken = buildUnsubscribeToken(userId, "all");
  return {
    unsubscribeUrl: `${APP_URL}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`,
    preferencesUrl: `${APP_URL}/settings`,
    unsubscribeAllUrl: `${APP_URL}/api/notifications/unsubscribe?token=${encodeURIComponent(globalToken)}`,
  };
}

function getPreferences(rawPrefs: unknown): Record<string, unknown> {
  if (!rawPrefs || typeof rawPrefs !== "object") return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(rawPrefs as Record<string, unknown>) };
}

function preferenceFieldForNotificationType(notificationType: string): string | null {
  if (notificationType === NOTIFICATION_TYPES.MAGIC_LINK_AUTH) return null;
  const map: Record<string, string> = {
    [NOTIFICATION_TYPES.INACTIVITY_REMINDER]: "email_inactivity_reminder",
    [NOTIFICATION_TYPES.MILESTONE_ACHIEVED]: "email_milestone_achieved",
    [NOTIFICATION_TYPES.BLUEPRINT_COMPLETED]: "email_blueprint_completed",
    [NOTIFICATION_TYPES.PIVOT_REVIEW_READY]: "email_pivot_review_ready",
    [NOTIFICATION_TYPES.BLUEPRINT_PAUSED_CONFIRMATION]: "email_blueprint_paused",
    [NOTIFICATION_TYPES.WEEKLY_SUMMARY]: "email_weekly_summary",
  };
  return map[notificationType] ?? null;
}

export function isEmailEnabled(prefs: Record<string, unknown>, notificationType: string): boolean {
  if (notificationType === NOTIFICATION_TYPES.MAGIC_LINK_AUTH) return true;
  if (prefs["email_all_disabled"] === true) return false;
  const key = preferenceFieldForNotificationType(notificationType);
  if (!key) return true;
  return prefs[key] !== false;
}

export function isInQuietHours(prefs: Record<string, unknown>, timezone: string): boolean {
  if (!prefs["quiet_hours_enabled"]) return false;

  const start = (prefs["quiet_hours_start"] as string) ?? "22:00";
  const end = (prefs["quiet_hours_end"] as string) ?? "08:00";

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "12", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const nowMin = hour * 60 + minute;

    const [startH, startM] = start.split(":").map(Number);
    const [endH, endM] = end.split(":").map(Number);
    const startMin = (startH ?? 22) * 60 + (startM ?? 0);
    const endMin = (endH ?? 8) * 60 + (endM ?? 0);

    if (startMin > endMin) {
      return nowMin >= startMin || nowMin < endMin;
    }
    return nowMin >= startMin && nowMin < endMin;
  } catch {
    return false;
  }
}

async function isFrequencyCapped(
  userId: string,
  notificationType: string,
  blueprintId: string | undefined,
): Promise<boolean> {
  const capHours = (FREQUENCY_CAP_HOURS as Record<string, number | undefined>)[notificationType];
  if (capHours === undefined || capHours <= 0) return false;

  const since = new Date(Date.now() - capHours * 3600000);

  const conds = [
    eq(notificationLogs.user_id, userId),
    eq(notificationLogs.notification_type, notificationType),
    eq(notificationLogs.status, "sent"),
    gte(notificationLogs.sent_at, since),
  ];
  if (blueprintId) {
    conds.push(eq(notificationLogs.blueprint_id, blueprintId));
  }

  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notificationLogs)
    .where(and(...conds));

  return (c ?? 0) > 0;
}

async function insertSuppressedLog(params: {
  userId: string;
  blueprintId?: string;
  notificationType: string;
  reason: string;
  sourceEventId?: string;
  idempotencyKey: string;
  snapshot?: DeliveryPayloadSnapshot;
}): Promise<string | undefined> {
  try {
    const [row] = await db
      .insert(notificationLogs)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId ?? null,
        notification_type: params.notificationType,
        channel: "email",
        status: "suppressed",
        suppression_reason: params.reason,
        source_event_id: params.sourceEventId ?? null,
        idempotency_key: params.idempotencyKey,
        attempt_count: 0,
        payload_snapshot: (params.snapshot ?? {}) as Record<string, unknown>,
      })
      .returning({ id: notificationLogs.id });
    return row?.id;
  } catch {
    return undefined;
  }
}

async function insertDeferredLog(params: {
  userId: string;
  blueprintId?: string;
  notificationType: string;
  sourceEventId?: string;
  idempotencyKey: string;
  snapshot: DeliveryPayloadSnapshot;
}): Promise<string | undefined> {
  try {
    const [row] = await db
      .insert(notificationLogs)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId ?? null,
        notification_type: params.notificationType,
        channel: "email",
        status: "deferred",
        suppression_reason: "quiet_hours",
        source_event_id: params.sourceEventId ?? null,
        idempotency_key: params.idempotencyKey,
        attempt_count: 0,
        payload_snapshot: params.snapshot as unknown as Record<string, unknown>,
      })
      .returning({ id: notificationLogs.id });
    return row?.id;
  } catch {
    return undefined;
  }
}

function buildEmailForType(params: {
  notificationType: NotificationType;
  ctx: NotificationContext;
  escalation?: boolean;
}): EmailContent | null {
  switch (params.notificationType) {
    case NOTIFICATION_TYPES.INACTIVITY_REMINDER:
      return buildInactivityReminder(params.ctx, params.escalation ?? false);
    case NOTIFICATION_TYPES.MILESTONE_ACHIEVED:
      return buildMilestoneAchieved(params.ctx);
    case NOTIFICATION_TYPES.BLUEPRINT_COMPLETED:
      return buildBlueprintCompleted(params.ctx);
    case NOTIFICATION_TYPES.PIVOT_REVIEW_READY:
      return buildPivotReviewReady(params.ctx);
    case NOTIFICATION_TYPES.BLUEPRINT_PAUSED_CONFIRMATION:
      return buildBlueprintPaused(params.ctx);
    case NOTIFICATION_TYPES.WEEKLY_SUMMARY:
      return buildWeeklySummary(params.ctx);
    default:
      return null;
  }
}

async function deliverEmail(params: {
  userId: string;
  email: string;
  notificationType: NotificationType;
  blueprintId?: string;
  sourceEventId?: string;
  contextData?: Partial<
    Omit<NotificationContext, "userId" | "unsubscribeUrl" | "preferencesUrl" | "unsubscribeAllUrl">
  >;
  escalation?: boolean;
  idempotencyKey: string;
  existingLogId?: string;
}): Promise<SendNotificationResult> {
  let blueprintGoal: string | null = null;
  if (params.blueprintId) {
    const [bp] = await db
      .select({ goal: blueprints.goal })
      .from(blueprints)
      .where(eq(blueprints.id, params.blueprintId))
      .limit(1);
    blueprintGoal = bp?.goal ?? null;
  }

  const { unsubscribeUrl, preferencesUrl, unsubscribeAllUrl } = buildUnsubscribeUrls(
    params.userId,
    params.notificationType,
  );

  const ctx: NotificationContext = {
    userId: params.userId,
    blueprintId: params.blueprintId,
    goalText: params.contextData?.goalText ?? blueprintGoal ?? undefined,
    unsubscribeUrl,
    preferencesUrl,
    unsubscribeAllUrl,
    ...params.contextData,
  };

  const emailContent = buildEmailForType({
    notificationType: params.notificationType,
    ctx,
    escalation: params.escalation,
  });

  if (!emailContent) {
    return { sent: false, suppressed: true, suppressionReason: "unknown_type" };
  }

  let logId = params.existingLogId;

  if (logId) {
    await db
      .update(notificationLogs)
      .set({
        status: "pending",
        suppression_reason: null,
        attempt_count: sql`${notificationLogs.attempt_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(notificationLogs.id, logId));
  } else {
    const [inserted] = await db
      .insert(notificationLogs)
      .values({
        user_id: params.userId,
        blueprint_id: params.blueprintId ?? null,
        notification_type: params.notificationType,
        channel: "email",
        status: "pending",
        source_event_id: params.sourceEventId ?? null,
        idempotency_key: params.idempotencyKey,
        attempt_count: 1,
        payload_snapshot: {} as Record<string, unknown>,
      })
      .returning({ id: notificationLogs.id });
    logId = inserted?.id;
  }

  if (!logId) {
    return { sent: false, suppressed: true, suppressionReason: "log_failed" };
  }

  const result = await sendEmail({
    from: FROM_HEADER,
    to: params.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  if (result.sent) {
    await db
      .update(notificationLogs)
      .set({ status: "sent", sent_at: new Date(), last_error: null, updated_at: new Date() })
      .where(eq(notificationLogs.id, logId));

    logger.info(
      { type: params.notificationType, userId: params.userId, logId },
      "[NotificationService] Sent",
    );

    return { sent: true, suppressed: false, logId };
  }

  const errMsg = result.error ?? "send_failed";

  const [current] = await db
    .select({ attempt_count: notificationLogs.attempt_count })
    .from(notificationLogs)
    .where(eq(notificationLogs.id, logId))
    .limit(1);

  const attempts = current?.attempt_count ?? 1;

  if (attempts >= 3) {
    await db
      .update(notificationLogs)
      .set({ status: "failed", last_error: errMsg, updated_at: new Date() })
      .where(eq(notificationLogs.id, logId));
    logger.error({ logId, error: errMsg }, "[NotificationService] Failed after max attempts");
    throw new Error("notification_send_exhausted");
  }

  await db
    .update(notificationLogs)
    .set({ status: "pending", last_error: errMsg, updated_at: new Date() })
    .where(eq(notificationLogs.id, logId));

  logger.warn({ logId, attempt: attempts, error: errMsg }, "[NotificationService] Delivery failed — retry");

  throw new Error(errMsg);
}

export async function sendNotification(params: SendNotificationParams): Promise<SendNotificationResult> {
  const idempotencyKey = `${params.userId}:${params.notificationType}:${params.blueprintId ?? ""}:${params.sourceEventId ?? "none"}`;

  const [existing] = await db
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.idempotency_key, idempotencyKey))
    .limit(1);

  if (existing) {
    if (existing.status === "sent") {
      return { sent: false, suppressed: true, suppressionReason: "duplicate", logId: existing.id };
    }
    if (existing.status === "deferred" && existing.suppression_reason === "quiet_hours") {
      return { sent: false, suppressed: true, suppressionReason: "quiet_hours", logId: existing.id };
    }
    if (existing.status === "suppressed") {
      return {
        sent: false,
        suppressed: true,
        suppressionReason: existing.suppression_reason ?? "suppressed",
        logId: existing.id,
      };
    }
  }

  const [user] = await db
    .select({
      email: users.email,
      display_name: users.display_name,
      notification_preferences: users.notification_preferences,
      timezone: users.timezone,
    })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!user?.email) {
    return { sent: false, suppressed: true, suppressionReason: "no_email" };
  }

  const prefs = getPreferences(user.notification_preferences);
  const timezone = user.timezone ?? "UTC";

  if (!isEmailEnabled(prefs, params.notificationType)) {
    const logId = await insertSuppressedLog({
      userId: params.userId,
      blueprintId: params.blueprintId,
      notificationType: params.notificationType,
      reason: "preference_disabled",
      sourceEventId: params.sourceEventId,
      idempotencyKey,
    });
    return { sent: false, suppressed: true, suppressionReason: "preference_disabled", logId };
  }

  const capped = await isFrequencyCapped(params.userId, params.notificationType, params.blueprintId);
  if (capped) {
    const logId = await insertSuppressedLog({
      userId: params.userId,
      blueprintId: params.blueprintId,
      notificationType: params.notificationType,
      reason: "frequency_cap",
      sourceEventId: params.sourceEventId,
      idempotencyKey,
    });
    return { sent: false, suppressed: true, suppressionReason: "frequency_cap", logId };
  }

  if (isInQuietHours(prefs, timezone)) {
    const snapshot: DeliveryPayloadSnapshot = {
      notificationType: params.notificationType,
      blueprintId: params.blueprintId,
      sourceEventId: params.sourceEventId,
      contextData: params.contextData,
      escalation: params.escalation,
    };
    const logId = await insertDeferredLog({
      userId: params.userId,
      blueprintId: params.blueprintId,
      notificationType: params.notificationType,
      sourceEventId: params.sourceEventId,
      idempotencyKey,
      snapshot,
    });
    return { sent: false, suppressed: true, suppressionReason: "quiet_hours", logId };
  }

  const retryLogId =
    existing && (existing.status === "pending" || existing.status === "failed") ? existing.id : undefined;

  return deliverEmail({
    userId: params.userId,
    email: user.email,
    notificationType: params.notificationType,
    blueprintId: params.blueprintId,
    sourceEventId: params.sourceEventId,
    contextData: {
      ...params.contextData,
      displayName: user.display_name,
    },
    escalation: params.escalation,
    idempotencyKey,
    existingLogId: retryLogId,
  });
}

export async function processDeferredNotifications(): Promise<number> {
  const deferredRows = await db
    .select()
    .from(notificationLogs)
    .where(
      and(eq(notificationLogs.status, "deferred"), eq(notificationLogs.suppression_reason, "quiet_hours")),
    )
    .orderBy(asc(notificationLogs.created_at))
    .limit(20);

  let processed = 0;

  for (const log of deferredRows) {
    const [user] = await db
      .select({
        email: users.email,
        notification_preferences: users.notification_preferences,
        timezone: users.timezone,
      })
      .from(users)
      .where(eq(users.id, log.user_id))
      .limit(1);

    if (!user?.email) {
      await db
        .update(notificationLogs)
        .set({
          status: "suppressed",
          suppression_reason: "no_email",
          updated_at: new Date(),
        })
        .where(eq(notificationLogs.id, log.id));
      continue;
    }

    const prefs = getPreferences(user.notification_preferences);
    const timezone = user.timezone ?? "UTC";

    if (isInQuietHours(prefs, timezone)) continue;

    const ageHours = (Date.now() - log.created_at.getTime()) / 3600000;
    if (ageHours > 12) {
      await db
        .update(notificationLogs)
        .set({
          status: "suppressed",
          suppression_reason: "deferred_stale",
          updated_at: new Date(),
        })
        .where(eq(notificationLogs.id, log.id));
      continue;
    }

    const snapshot = log.payload_snapshot as DeliveryPayloadSnapshot;
    if (!snapshot?.notificationType) {
      await db
        .update(notificationLogs)
        .set({ status: "suppressed", suppression_reason: "invalid_snapshot", updated_at: new Date() })
        .where(eq(notificationLogs.id, log.id));
      continue;
    }

    if (!isEmailEnabled(prefs, snapshot.notificationType)) {
      await db
        .update(notificationLogs)
        .set({
          status: "suppressed",
          suppression_reason: "preference_disabled",
          updated_at: new Date(),
        })
        .where(eq(notificationLogs.id, log.id));
      continue;
    }

    const capped = await isFrequencyCapped(
      log.user_id,
      snapshot.notificationType,
      snapshot.blueprintId ?? undefined,
    );
    if (capped) {
      await db
        .update(notificationLogs)
        .set({
          status: "suppressed",
          suppression_reason: "frequency_cap",
          updated_at: new Date(),
        })
        .where(eq(notificationLogs.id, log.id));
      continue;
    }

    try {
      await deliverEmail({
        userId: log.user_id,
        email: user.email,
        notificationType: snapshot.notificationType,
        blueprintId: snapshot.blueprintId,
        sourceEventId: snapshot.sourceEventId,
        contextData: snapshot.contextData,
        escalation: snapshot.escalation,
        idempotencyKey: log.idempotency_key,
        existingLogId: log.id,
      });
      processed++;
    } catch {
      /* retry on next interval / worker */
    }
  }

  return processed;
}

export async function processUnsubscribe(token: string): Promise<{
  success: boolean;
  notificationType?: string;
  isGlobal?: boolean;
}> {
  const verified = verifyUnsubscribeToken(token);
  if (!verified.valid) return { success: false };

  const { userId, notificationType } = verified;

  const [user] = await db
    .select({ notification_preferences: users.notification_preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { success: false };

  const prefs = getPreferences(user.notification_preferences) as NotificationPreferences & Record<string, unknown>;

  if (notificationType === "all") {
    const updated = { ...prefs, email_all_disabled: true };
    await db
      .update(users)
      .set({ notification_preferences: updated as NotificationPreferences })
      .where(eq(users.id, userId));
    return { success: true, isGlobal: true };
  }

  const prefKey = preferenceFieldForNotificationType(notificationType);
  if (!prefKey) return { success: false };

  const updated = { ...prefs, [prefKey]: false };
  await db
    .update(users)
    .set({ notification_preferences: updated as NotificationPreferences })
    .where(eq(users.id, userId));

  return { success: true, notificationType, isGlobal: false };
}

export async function handleBounce(email: string, bounceType: string): Promise<void> {
  if (bounceType !== "hard") return;

  const normalized = email.toLowerCase().trim();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return;

  const [row] = await db
    .select({ notification_preferences: users.notification_preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const prefs = getPreferences(row?.notification_preferences) as NotificationPreferences & Record<string, unknown>;
  await db
    .update(users)
    .set({ notification_preferences: { ...prefs, email_all_disabled: true } as NotificationPreferences })
    .where(eq(users.id, user.id));

  logger.warn({ email: normalized }, "[NotificationService] Hard bounce — email suppressed");
}

export async function handleComplaint(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, normalized)).limit(1);
  if (!user) return;

  const [row] = await db
    .select({ notification_preferences: users.notification_preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const prefs = getPreferences(row?.notification_preferences) as NotificationPreferences & Record<string, unknown>;
  await db
    .update(users)
    .set({ notification_preferences: { ...prefs, email_all_disabled: true } as NotificationPreferences })
    .where(eq(users.id, user.id));

  logger.warn({ email: normalized }, "[NotificationService] Spam complaint — email globally disabled");
}

export async function getMergedNotificationPreferences(userId: string): Promise<Record<string, unknown>> {
  const [user] = await db
    .select({ notification_preferences: users.notification_preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return getPreferences(user?.notification_preferences);
}
