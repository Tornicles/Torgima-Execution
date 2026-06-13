import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../services/AuthService.js";
import { TorgimaError } from "./errors.js";
import { logger } from "./logger.js";
import type { AuthClass, AuthContext } from "../types/auth.js";
import { extractInternalToken, getInternalAuthSecret } from "./security/internalAuth.js";
import { logAuthSecurityEvent } from "./auth-security-log.js";
import { verifySupabaseJwt } from "./supabase.js";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isDbConnectivityError } from "./dbConnectivity.js";
import { isLaunchMode } from "./launch-mode.js";

export const SESSION_COOKIE_NAME = "torgima_session";

function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  const cookieToken = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  return null;
}

function buildInternalContext(): AuthContext {
  return {
    userId: "internal",
    sessionId: "internal",
    userMode: "individual",
    userTier: "system",
    isInternal: true,
  };
}

const profileSelect = { id: users.id, mode: users.mode, tier: users.tier };

/**
 * Look up a public.users row for a Supabase auth user.
 * Lookup order: supabase_id → lowercase email → legacy id match.
 * public.users.id may differ from auth.users.id on legacy rows; always return public.users.id.
 */
async function resolveUserFromSupabase(
  supabaseId: string,
  email: string,
): Promise<{ id: string; mode: string; tier: string } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  try {
    const [bySupabaseId] = await db
      .select(profileSelect)
      .from(users)
      .where(eq(users.supabase_id, supabaseId))
      .limit(1);
    if (bySupabaseId) return bySupabaseId;

    const [byEmail] = await db
      .select(profileSelect)
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    if (byEmail) return byEmail;

    const [byLegacyId] = await db
      .select(profileSelect)
      .from(users)
      .where(eq(users.id, supabaseId))
      .limit(1);
    return byLegacyId ?? null;
  } catch (err) {
    if (isDbConnectivityError(err)) throw err;
    return null;
  }
}

function buildSupabaseJwtContext(
  supabaseUser: { userId: string; email: string },
  profile: { id: string; mode: string; tier: string },
  degraded = false,
): AuthContext {
  return {
    userId: profile.id,
    sessionId: degraded ? "supabase-jwt-degraded" : "supabase-jwt",
    userMode: (profile.mode === "team" ? "team" : "individual") as "individual" | "team",
    userTier: String(profile.tier ?? "starter"),
    isInternal: false,
  };
}

/** When Postgres is unreachable, trust a verified Supabase JWT and use auth.users.id as userId. */
function buildDegradedSupabaseJwtContext(supabaseUser: {
  userId: string;
  email: string;
}): AuthContext {
  return {
    userId: supabaseUser.userId,
    sessionId: "supabase-jwt-degraded",
    userMode: "individual",
    userTier: "starter",
    isInternal: false,
  };
}

/**
 * Create or link a public.users row for a Supabase auth user.
 * Idempotent: never creates duplicate profiles for the same email or supabase id.
 */
async function createUserFromSupabase(
  supabaseId: string,
  email: string,
): Promise<{ id: string; mode: string; tier: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Link existing legacy profile (magic-link era) by email.
  const existing = await resolveUserFromSupabase(supabaseId, normalizedEmail);
  if (existing) {
    await db
      .update(users)
      .set({ supabase_id: supabaseId, updated_at: new Date() })
      .where(eq(users.id, existing.id))
      .catch(() => null);
    return existing;
  }

  // Preferred model: public.users.id = auth.users.id
  const [user] = await db
    .insert(users)
    .values({
      id: supabaseId,
      email: normalizedEmail,
      supabase_id: supabaseId,
      mode: "individual",
      tier: "starter",
      onboarding_complete: false,
      active: true,
      execution_state: "NORMAL",
      first_login_after_upgrade: false,
      notification_preferences: {},
      metadata: {},
      civilization_context: {},
      communication_profile: {},
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { supabase_id: supabaseId, updated_at: new Date() },
    })
    .returning({ id: users.id, mode: users.mode, tier: users.tier });

  if (!user) {
    throw new TorgimaError("INTERNAL_ERROR", "Failed to create user profile");
  }
  return user;
}

export async function requireAuth(req: Request, authClass: AuthClass): Promise<AuthContext> {
  if (authClass === "PUBLIC") {
    return { userId: "", sessionId: "", userMode: "individual", userTier: "", isInternal: false };
  }

  if (authClass === "INTERNAL_SERVICE" || authClass === "ADMIN_INTERNAL") {
    if (req.headers.origin) {
      await logAuthSecurityEvent(
        "BROWSER_INTERNAL_ROUTE_ATTEMPT",
        { origin: req.headers.origin, path: req.path, ip: req.ip },
        "ERROR",
      );
      throw new TorgimaError("FORBIDDEN", "Internal route not accessible from browser");
    }
    const configured = getInternalAuthSecret();
    const secret = extractInternalToken(req);
    if (!configured || !secret || secret !== configured) {
      logger.error(
        { path: req.path, ip: req.ip },
        "[SECURITY] Internal route accessed without valid internal token",
      );
      throw new TorgimaError("FORBIDDEN", "Internal auth required");
    }
    return buildInternalContext();
  }

  const sessionToken = extractSessionToken(req);

  if (!sessionToken) {
    if (authClass === "OPTIONAL_SESSION") {
      return { userId: "", sessionId: "", userMode: "individual", userTier: "", isInternal: false };
    }
    throw new TorgimaError("UNAUTHENTICATED", "Authentication required");
  }

  // ── Supabase JWT path ────────────────────────────────────────────────────
  // Supabase JWTs are base64url-encoded and always start with "eyJ".
  // Try this first so email/password logins work without touching legacy session tables.
  if (sessionToken.startsWith("eyJ")) {
    const supabaseUser = await verifySupabaseJwt(sessionToken);
    if (supabaseUser) {
      try {
        let profile = await resolveUserFromSupabase(supabaseUser.userId, supabaseUser.email);

        if (!profile) {
          // Safety net: trigger may not have fired yet (migration pending).
          profile = await createUserFromSupabase(supabaseUser.userId, supabaseUser.email);
          logger.info(
            { email: supabaseUser.email },
            "[Auth] Created public.users row for new Supabase user",
          );
        }

        return buildSupabaseJwtContext(supabaseUser, profile);
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const dbUnavailable = isDbConnectivityError(err);
        if (dbUnavailable || isLaunchMode()) {
          logger.warn(
            {
              email: supabaseUser.email,
              err: errMessage,
              launchMode: isLaunchMode(),
              dbUnavailable,
            },
            "[Auth] Profile DB lookup failed — Supabase JWT passthrough (degraded)",
          );
          return buildDegradedSupabaseJwtContext(supabaseUser);
        }

        logger.error(
          { err: errMessage, email: supabaseUser.email },
          "[Auth] Could not resolve public.users row for Supabase user",
        );
        throw new TorgimaError(
          "INTERNAL_ERROR",
          "Profile sync failed — please try again",
          true,
        );
      }
    }

    // JWT verification failed — don't fall through to legacy path for JWT-shaped tokens
    if (authClass === "OPTIONAL_SESSION") {
      return { userId: "", sessionId: "", userMode: "individual", userTier: "", isInternal: false };
    }
    throw new TorgimaError("UNAUTHENTICATED", "Session expired — please sign in again");
  }

  // ── Legacy session token path (cookie-based magic-link sessions) ──────────
  // Preserved for any users still holding an active magic-link session.
  try {
    return await validateSession(sessionToken);
  } catch (err) {
    if (authClass === "OPTIONAL_SESSION") {
      return { userId: "", sessionId: "", userMode: "individual", userTier: "", isInternal: false };
    }
    throw err;
  }
}

export function assertOwnership(
  auth: AuthContext,
  resourceUserId: string,
  resourceType: string,
): void {
  if (auth.isInternal) return;
  if (auth.userId !== resourceUserId) {
    void logAuthSecurityEvent(
      "CROSS_USER_ACCESS_ATTEMPT",
      { authUserId: auth.userId, resourceUserId, resourceType },
      "ERROR",
    );
    throw new TorgimaError("NOT_FOUND", `${resourceType} not found`);
  }
}

// Express middleware factory for route-level auth
/** Internal/debug probe — tests Supabase token → public.users profile chain. */
export async function probeSupabaseAuthToken(token: string | null): Promise<{
  authHeaderReceived: boolean;
  tokenVerified: boolean;
  publicProfileFound: boolean;
  publicProfileCreated: boolean;
  profileSyncError: string | null;
  profileSyncDegraded: boolean;
}> {
  if (!token?.startsWith("eyJ")) {
    return {
      authHeaderReceived: Boolean(token),
      tokenVerified: false,
      publicProfileFound: false,
      publicProfileCreated: false,
      profileSyncError: null,
      profileSyncDegraded: false,
    };
  }

  const supabaseUser = await verifySupabaseJwt(token);
  if (!supabaseUser) {
    return {
      authHeaderReceived: true,
      tokenVerified: false,
      publicProfileFound: false,
      publicProfileCreated: false,
      profileSyncError: null,
      profileSyncDegraded: false,
    };
  }

  try {
    let profile = await resolveUserFromSupabase(supabaseUser.userId, supabaseUser.email);
    if (profile) {
      return {
        authHeaderReceived: true,
        tokenVerified: true,
        publicProfileFound: true,
        publicProfileCreated: false,
        profileSyncError: null,
        profileSyncDegraded: false,
      };
    }

    profile = await createUserFromSupabase(supabaseUser.userId, supabaseUser.email);
    return {
      authHeaderReceived: true,
      tokenVerified: true,
      publicProfileFound: Boolean(profile),
      publicProfileCreated: true,
      profileSyncError: null,
      profileSyncDegraded: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const degraded = isDbConnectivityError(err) || isLaunchMode();
    return {
      authHeaderReceived: true,
      tokenVerified: true,
      publicProfileFound: false,
      publicProfileCreated: false,
      profileSyncError: message.slice(0, 200),
      profileSyncDegraded: degraded,
    };
  }
}

export function withAuth(authClass: AuthClass) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      (req as Request & { auth: AuthContext }).auth = await requireAuth(req, authClass);
      next();
    } catch (err) {
      next(err);
    }
  };
}
