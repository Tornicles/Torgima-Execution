import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../services/AuthService.js";
import { TorgimaError } from "./errors.js";
import { logger } from "./logger.js";
import type { AuthClass, AuthContext } from "../types/auth.js";
import { extractInternalToken, getInternalAuthSecret } from "./security/internalAuth.js";
import { logAuthSecurityEvent } from "./auth-security-log.js";
import { verifySupabaseJwt } from "./supabase.js";
import { db, users } from "@workspace/db";
import { eq, or } from "drizzle-orm";

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

/**
 * Look up a public.users row by Supabase auth user id or email.
 * Falls back to email lookup so it works before migration 0040 is applied.
 */
async function resolveUserFromSupabase(
  supabaseId: string,
  email: string,
): Promise<{ id: string; mode: string; tier: string } | null> {
  try {
    const [user] = await db
      .select({ id: users.id, mode: users.mode, tier: users.tier })
      .from(users)
      .where(or(eq(users.supabase_id, supabaseId), eq(users.email, email)))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a minimal public.users row for a Supabase auth user who has no profile yet.
 * This is a safety net — the trigger in migration 0040 normally handles creation.
 */
async function createUserFromSupabase(
  supabaseId: string,
  email: string,
): Promise<{ id: string; mode: string; tier: string }> {
  const [user] = await db
    .insert(users)
    .values({
      email,
      supabase_id: supabaseId,
      mode: "individual",
      tier: "starter",
      onboarding_complete: false,
      active: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { supabase_id: supabaseId, updated_at: new Date() },
    })
    .returning({ id: users.id, mode: users.mode, tier: users.tier });
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
      let profile = await resolveUserFromSupabase(supabaseUser.userId, supabaseUser.email);

      if (!profile) {
        // Safety net: trigger may not have fired yet (migration pending).
        try {
          profile = await createUserFromSupabase(supabaseUser.userId, supabaseUser.email);
          logger.info(
            { email: supabaseUser.email },
            "[Auth] Created public.users row for new Supabase user",
          );
        } catch (err) {
          logger.error({ err }, "[Auth] Could not create public.users row for Supabase user");
          if (authClass === "OPTIONAL_SESSION") {
            return {
              userId: "",
              sessionId: "",
              userMode: "individual",
              userTier: "",
              isInternal: false,
            };
          }
          throw new TorgimaError("INTERNAL_ERROR", "Authentication failed — please try again");
        }
      }

      return {
        userId: profile.id,
        sessionId: "supabase-jwt",
        userMode: (profile.mode === "team" ? "team" : "individual") as "individual" | "team",
        userTier: String(profile.tier ?? "starter"),
        isInternal: false,
      };
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
