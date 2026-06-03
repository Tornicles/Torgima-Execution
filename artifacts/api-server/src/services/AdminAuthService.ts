import crypto from "crypto";
import { db, adminSessions } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { TorgimaError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getAdminConfig() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!email || !password || !sessionSecret) {
    return null;
  }
  return { email, password, sessionSecret };
}

export function isAdminPanelConfigured(): boolean {
  return getAdminConfig() != null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export async function adminLogin(params: {
  email: string;
  password: string;
  ip?: string;
}): Promise<{ sessionId: string; email: string }> {
  const config = getAdminConfig();
  if (!config) {
    throw new TorgimaError("FORBIDDEN", "Admin panel is not configured", false);
  }

  const email = params.email.trim().toLowerCase();
  if (email !== config.email || !timingSafeEqual(params.password, config.password)) {
    logger.warn({ email }, "[AdminAuth] Failed login attempt");
    throw new TorgimaError("FORBIDDEN", "Invalid admin credentials", false);
  }

  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS);
  const [row] = await db
    .insert(adminSessions)
    .values({
      admin_email: email,
      expires_at: expiresAt,
      ip_hash: hashIp(params.ip),
    })
    .returning({ id: adminSessions.id });

  if (!row) throw new TorgimaError("INTERNAL_ERROR", "Failed to create admin session");

  logger.info({ adminEmail: email }, "[AdminAuth] Admin session created");
  return { sessionId: row.id, email };
}

export async function adminLogout(sessionId: string): Promise<void> {
  await db
    .update(adminSessions)
    .set({ revoked: true })
    .where(eq(adminSessions.id, sessionId));
}

export async function validateAdminSession(
  sessionId: string | undefined,
): Promise<{ email: string; sessionId: string } | null> {
  if (!sessionId || !isAdminPanelConfigured()) return null;

  const [row] = await db
    .select({
      id: adminSessions.id,
      email: adminSessions.admin_email,
      revoked: adminSessions.revoked,
      expiresAt: adminSessions.expires_at,
    })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.id, sessionId),
        eq(adminSessions.revoked, false),
        gt(adminSessions.expires_at, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;
  return { email: row.email, sessionId: row.id };
}
