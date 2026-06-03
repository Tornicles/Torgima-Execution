import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../services/AuthService.js";
import { TorgimaError } from "./errors.js";
import { logger } from "./logger.js";
import type { AuthClass, AuthContext } from "../types/auth.js";
import { extractInternalToken, getInternalAuthSecret } from "./security/internalAuth.js";
import { logAuthSecurityEvent } from "./auth-security-log.js";

export const SESSION_COOKIE_NAME = "torgima_session";

function extractSessionToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

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
