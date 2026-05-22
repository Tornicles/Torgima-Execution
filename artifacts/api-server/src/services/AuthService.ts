import crypto from "crypto";
import { db } from "@workspace/db";
import { users, sessions, blueprints } from "@workspace/db";
import { eq, and, gt, like } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import { sendEmail, EMAIL_FROM_HEADER } from "../lib/resend.js";
import { resolveAppUrl } from "../lib/app-url.js";
import type { AuthContext, SafeUser } from "../types/auth.js";

const SESSION_MAX_HOURS = 24 * 30;
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

  // Delete only pending magic-link rows (prefix `magic:`), not long-lived user sessions
  await db
    .delete(sessions)
    .where(and(eq(sessions.user_id, userId), like(sessions.token_hash, `${MAGIC_PREFIX}%`)))
    .catch(() => null);

  // Store magic link as a short-lived session row
  await db.insert(sessions).values({
    user_id: userId,
    token_hash: MAGIC_PREFIX + tokenHash,
    expires_at: expiresAt,
  });

  const verifyUrl = `${resolveAppUrl()}/verify?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

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
    subject: "Your Torgima sign-in link",
    text: `Sign in to Torgima:\n\n${verifyUrl}\n\nThis link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.`,
    html:
      `<p>Sign in to Torgima:</p>` +
      `<p><a href="${verifyUrl}">Sign in</a></p>` +
      `<p style="color:#666;font-size:12px">` +
      `Or paste this link into your browser:<br/>${verifyUrl}<br/><br/>` +
      `This link expires in ${MAGIC_LINK_EXPIRY_MINUTES} minutes. If you did not request this, ignore this email.` +
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

  // Find the magic link session
  const [magicSession] = await db
    .select({ sessionId: sessions.id, userId: sessions.user_id, expiresAt: sessions.expires_at })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(
      and(
        eq(sessions.token_hash, MAGIC_PREFIX + tokenHash),
        gt(sessions.expires_at, new Date()),
        eq(users.email, normalizedEmail),
      ),
    )
    .limit(1);

  if (!magicSession) {
    throw new TorgimaError("UNAUTHENTICATED", "Invalid or expired magic link");
  }

  // Delete the magic link session (single use)
  await db.delete(sessions).where(eq(sessions.id, magicSession.sessionId));

  // Create a real session
  const sessionRawToken = crypto.randomBytes(32).toString("hex");
  const sessionTokenHash = crypto.createHash("sha256").update(sessionRawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_HOURS * 60 * 60 * 1000);

  await db.insert(sessions).values({
    user_id: magicSession.userId,
    token_hash: sessionTokenHash,
    expires_at: expiresAt,
  });

  const user = await getUser(magicSession.userId);

  logger.info({ userId: magicSession.userId }, "[AuthService] Magic link verified, session created");

  return { sessionToken: sessionRawToken, user };
}

// ── VALIDATE SESSION ───────────────────────────────────────────────────────────

export async function validateSession(sessionToken: string): Promise<AuthContext> {
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
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(eq(sessions.token_hash, tokenHash))
    .limit(1);

  if (!row) {
    throw new TorgimaError("UNAUTHENTICATED", "Session not found");
  }

  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId)).catch(() => null);
    throw new TorgimaError("UNAUTHENTICATED", "Session expired");
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
  };
}

// ── REVOKE SESSION ─────────────────────────────────────────────────────────────

export async function revokeSession(sessionToken: string): Promise<void> {
  const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
  await db.delete(sessions).where(eq(sessions.token_hash, tokenHash));
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

function toSafeUser(user: typeof users.$inferSelect, activeBlueprintId: string | null): SafeUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    mode: user.mode,
    tier: user.tier,
    onboardingComplete: user.onboarding_complete,
    activeBlueprintId,
    timezone: user.timezone,
    notificationPreferences: (user.notification_preferences as Record<string, unknown>) ?? {},
  };
}
