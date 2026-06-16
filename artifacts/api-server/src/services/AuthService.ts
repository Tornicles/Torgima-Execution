import crypto from "crypto";
import { db } from "@workspace/db";
import { users, sessions, blueprints, magicLinkTokens } from "@workspace/db";
import { eq, and, gt, like, not } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { sendEmail, EMAIL_FROM_HEADER } from "../lib/resend.js";
import { buildMagicLinkVerifyUrl } from "../lib/api-url.js";
import { logAuthSecurityEvent } from "../lib/auth-security-log.js";
import { kvCreateSession, kvDeleteSession, kvGetSession, kvSessionsEnabled } from "../lib/session-kv.js";
import type { AuthContext, SafeUser } from "../types/auth.js";

const SESSION_MAX_HOURS = 24 * 30;
const SESSION_IDLE_DAYS = 7;
const SESSION_IDLE_MS = SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAGIC_PREFIX = "magic:";

export type SendMagicLinkResult = {
  sent: boolean;
  /** User-safe hint when `sent` is false (missing Resend, provider error, etc.). */
  message?: string;
  /** Non-production only: recoverable link when outbound email is skipped. */
  devVerifyUrl?: string;
};

// ── MAGIC LINK ────────────────────────────────────────────────────────────────

export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  const normalizedEmail = email.toLowerCase().trim();
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

  // Upsert user
  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  let userId: string;
  if (existing.length > 0) {
    userId = existing[0]!.id;
  } else {
    const [newUser] = await db.insert(users).values({ email: normalizedEmail }).returning({ id: users.id });
    if (!newUser) throw new TorgimaError("INTERNAL_ERROR", "Failed to create user");
    userId = newUser.id;
  }

  // Clear prior magic links for this user (DOC 30 magic_link_tokens table)
  await db.delete(magicLinkTokens).where(eq(magicLinkTokens.user_id, userId)).catch(() => null);
  await db
    .delete(sessions)
    .where(and(eq(sessions.user_id, userId), like(sessions.token_hash, `${MAGIC_PREFIX}%`)))
    .catch(() => null);

  await db.insert(magicLinkTokens).values({
    user_id: userId,
    email: normalizedEmail,
    token: tokenHash,
    used: false,
    expires_at: expiresAt,
  });

  const verifyUrl = buildMagicLinkVerifyUrl(rawToken, normalizedEmail);

  // Always log a dev-friendly trail so the link is recoverable when no
  // email provider is configured. In production we additionally try Resend.
  if (process.env["NODE_ENV"] !== "production") {
    logger.info({ verifyUrl, userId }, "[AuthService] Magic link generated (dev mode)");
  } else {
    logger.info({ userId }, "[AuthService] Magic link generated");
  }

  const result = await sendEmail({
    from: EMAIL_FROM_HEADER,
    to: normalizedEmail,
    subject: "Your Torgima access link",
    text:
      `Click the link below to access Torgima. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.\n` +
      `Do not share this link with anyone.\n\n` +
      `${verifyUrl}\n\n` +
      `If you did not request this, ignore this email.`,
    html:
      `<p>Click the link below to access Torgima. This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes.</p>` +
      `<p>Do not share this link with anyone.</p>` +
      `<p><a href="${verifyUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Access Torgima</a></p>` +
      `<p style="color:#666;font-size:12px">` +
      `Or paste this link into your browser:<br/>${verifyUrl}<br/><br/>` +
      `If you did not request this, ignore this email.` +
      `</p>`,
  });

  if (result.sent) {
    return { sent: true };
  }

  const isDev = process.env["NODE_ENV"] !== "production";
  const message =
    result.error?.includes("RESEND_API_KEY") ?
      "Sign-in email is not configured on the server. Ask an administrator to set RESEND_API_KEY and verify EMAIL_FROM in Resend."
    : "We could not send the sign-in email. Check spam, wait a minute, and try again.";

  return {
    sent: false,
    message,
    ...(isDev ? { devVerifyUrl: verifyUrl } : {}),
  };
}

// ── VERIFY MAGIC LINK ─────────────────────────────────────────────────────────

export async function verifyMagicLink(
  rawToken: string,
  email: string,
): Promise<{ sessionToken: string; user: SafeUser }> {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const [tokenRow] = await db
    .select({
      id: magicLinkTokens.id,
      userId: magicLinkTokens.user_id,
      used: magicLinkTokens.used,
      expiresAt: magicLinkTokens.expires_at,
    })
    .from(magicLinkTokens)
    .where(
      and(eq(magicLinkTokens.token, tokenHash), eq(magicLinkTokens.email, normalizedEmail)),
    )
    .limit(1);

  let resolvedUserId: string | null = tokenRow?.userId ?? null;

  if (tokenRow?.used) {
    await logAuthSecurityEvent(
      "MAGIC_LINK_REUSE_ATTEMPT",
      { email: normalizedEmail, tokenId: tokenRow.id },
      "ERROR",
    );
    throw new TorgimaError("UNAUTHENTICATED", "Invalid or expired magic link", false);
  }

  if (tokenRow && tokenRow.expiresAt >= now) {
    await db
      .update(magicLinkTokens)
      .set({ used: true })
      .where(eq(magicLinkTokens.id, tokenRow.id));
  } else {
    const [legacyMagic] = await db
      .select({ sessionId: sessions.id, userId: sessions.user_id })
      .from(sessions)
      .innerJoin(users, eq(sessions.user_id, users.id))
      .where(
        and(
          eq(sessions.token_hash, MAGIC_PREFIX + tokenHash),
          gt(sessions.expires_at, now),
          eq(users.email, normalizedEmail),
        ),
      )
      .limit(1);

    if (!legacyMagic) {
      await logAuthSecurityEvent("MAGIC_LINK_INVALID", { email: normalizedEmail }, "WARN");
      throw new TorgimaError("UNAUTHENTICATED", "Invalid or expired magic link", false);
    }

    resolvedUserId = legacyMagic.userId;
    await db.delete(sessions).where(eq(sessions.id, legacyMagic.sessionId));
  }

  if (!resolvedUserId) {
    throw new TorgimaError("UNAUTHENTICATED", "Invalid or expired magic link", false);
  }

  const sessionRawToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = crypto.createHash("sha256").update(sessionRawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({
    user_id: resolvedUserId,
    token_hash: sessionTokenHash,
    expires_at: expiresAt,
  });

  const user = await getUser(resolvedUserId);

  logger.info({ userId: resolvedUserId }, "[AuthService] Magic link verified, session created");

  return { sessionToken: sessionRawToken, user };
}

// ── VALIDATE SESSION ───────────────────────────────────────────────────────────

export async function validateSession(sessionToken: string): Promise<AuthContext> {
  if (kvSessionsEnabled()) {
    const kvSession = await kvGetSession(sessionToken);
    if (kvSession?.userId) {
      const [userRow] = await db
        .select({
          userActive: users.active,
          userMode: users.mode,
          userTier: users.tier,
          email: users.email,
          dashboardMode: users.dashboard_mode,
          erectorTier: users.erector_tier,
        })
        .from(users)
        .where(eq(users.id, kvSession.userId))
        .limit(1);

      if (!userRow) {
        throw new TorgimaError("UNAUTHENTICATED", "Session not found");
      }
      if (!userRow.userActive) {
        throw new TorgimaError("FORBIDDEN", "Account is inactive");
      }

      return {
        userId: kvSession.userId,
        sessionId: `kv:${tokenHashPrefix(sessionToken)}`,
        userMode: userRow.userMode as "individual" | "team",
        userTier: userRow.userTier,
        isInternal: false,
        email: userRow.email,
        dashboardMode: userRow.dashboardMode ?? "limited",
        erectorTier: userRow.erectorTier ?? null,
      };
    }
  }

  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");

  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.user_id,
      expiresAt: sessions.expires_at,
      lastUsedAt: sessions.last_used_at,
      userActive: users.active,
      userMode: users.mode,
      userTier: users.tier,
      email: users.email,
      dashboardMode: users.dashboard_mode,
      erectorTier: users.erector_tier,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(
      and(
        eq(sessions.token_hash, tokenHash),
        not(like(sessions.token_hash, `${MAGIC_PREFIX}%`)),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TorgimaError("UNAUTHENTICATED", "Session not found");
  }

  const now = new Date();

  if (row.expiresAt < now) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId)).catch(() => null);
    throw new TorgimaError("UNAUTHENTICATED", "Session expired", false);
  }

  if (now.getTime() - row.lastUsedAt.getTime() > SESSION_IDLE_MS) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId)).catch(() => null);
    await logAuthSecurityEvent(
      "SESSION_IDLE_EXPIRED",
      { sessionId: row.sessionId, userId: row.userId },
      "INFO",
    );
    throw new TorgimaError("UNAUTHENTICATED", "Session expired due to inactivity", false);
  }

  if (!row.userActive) {
    throw new TorgimaError("FORBIDDEN", "Account is inactive");
  }

  // Refresh lastUsedAt at most once per hour
  if (Date.now() - row.lastUsedAt.getTime() > SESSION_REFRESH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ last_used_at: new Date() })
      .where(eq(sessions.id, row.sessionId))
      .catch(() => null);
  }

  return {
    userId: row.userId,
    sessionId: row.sessionId,
    userMode: row.userMode as "individual" | "team",
    userTier: row.userTier,
    isInternal: false,
    email: row.email,
    dashboardMode: row.dashboardMode ?? "limited",
    erectorTier: row.erectorTier ?? null,
  };
}

// ── REVOKE SESSION ─────────────────────────────────────────────────────────────

export async function revokeSession(sessionToken: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
  const [sessionRow] = await db
    .select({ user_id: sessions.user_id })
    .from(sessions)
    .where(eq(sessions.token_hash, tokenHash))
    .limit(1);

  await db.delete(sessions).where(eq(sessions.token_hash, tokenHash));

  if (kvSessionsEnabled()) {
    await kvDeleteSession(sessionToken).catch(() => null);
  }

  if (sessionRow?.user_id) {
    const { BhudhiMemoryService } = await import("../bhudhi/BhudhiMemoryService.js");
    await BhudhiMemoryService.clearSessionScopeForUser(sessionRow.user_id).catch((err) => {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), userId: sessionRow.user_id },
        "[AuthService] Session memory cleanup failed",
      );
    });
  }

  logger.info("[AuthService] Session revoked");
}

// ── GET USER ───────────────────────────────────────────────────────────────────

export async function getUser(userId: string): Promise<SafeUser> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TorgimaError("NOT_FOUND", "User not found");
  const [activeBp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return toSafeUser(user, activeBp?.id ?? null);
}

// ── UPDATE USER SETTINGS ───────────────────────────────────────────────────────

export async function updateUserSettings(
  userId: string,
  updates: {
    display_name?: string;
    timezone?: string;
    commitment_level?: "low" | "medium" | "high" | "full";
    notification_preferences?: Record<string, unknown>;
  },
): Promise<SafeUser> {
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new TorgimaError("NOT_FOUND", "User not found");
  const [activeBp] = await db
    .select({ id: blueprints.id })
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  return toSafeUser(updated, activeBp?.id ?? null);
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

function tokenHashPrefix(sessionToken: string): string {
  return crypto.createHash("sha256").update(sessionToken).digest("hex").slice(0, 12);
}

function toSafeUser(user: typeof users.$inferSelect, activeBlueprintId: string | null): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    mode: user.mode,
    tier: user.tier,
    onboardingComplete: user.onboarding_complete,
    executionState: user.execution_state ?? "NORMAL",
    firstLoginAfterUpgrade: user.first_login_after_upgrade ?? false,
    activeBlueprintId,
    timezone: user.timezone,
    notificationPreferences: (user.notification_preferences as Record<string, unknown>) ?? {},
    dashboardMode: user.dashboard_mode ?? "limited",
    erectorTier: user.erector_tier ?? null,
  };
}
