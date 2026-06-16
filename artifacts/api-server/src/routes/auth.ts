import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  sendMagicLink,
  verifyMagicLink,
  revokeSession,
  getUser,
} from "../services/AuthService.js";
import { buildSessionResponse } from "../lib/session-contract.js";
import { requireAuth, SESSION_COOKIE_NAME } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { logger } from "../lib/logger.js";
import { resolveAppUrl } from "../lib/app-url.js";
import {
  bindCloudflareEnv,
  isCloudflareRuntime,
  type TorgimaWorkerEnv,
} from "../lib/cloudflare-runtime.js";
import { bindWorkerDatabaseUrl } from "@workspace/db";
import {
  magicLinkHourlyLimit,
  magicLinkVerifyLimit,
} from "../middleware/apiRateLimit.js";

type MagicLinkRequest = Request & { env?: TorgimaWorkerEnv };

function magicLinkWorkerContext(req: Request): { env: TorgimaWorkerEnv } {
  const reqEnv = (req as MagicLinkRequest).env;
  if (reqEnv) return { env: reqEnv };
  return {
    env: {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      APP_URL: process.env.APP_URL,
      EMAIL_FROM: process.env.EMAIL_FROM,
      INTERNAL_AUTH_SECRET: process.env.INTERNAL_AUTH_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  };
}

function bindMagicLinkWorkerSecrets(c: { env: TorgimaWorkerEnv }): void {
  if (!isCloudflareRuntime()) return;
  const payload: TorgimaWorkerEnv = {};
  if (typeof c.env.RESEND_API_KEY === "string" && c.env.RESEND_API_KEY.trim()) {
    payload.RESEND_API_KEY = c.env.RESEND_API_KEY.trim();
  }
  if (typeof c.env.APP_URL === "string" && c.env.APP_URL.trim()) {
    payload.APP_URL = c.env.APP_URL.trim();
  }
  if (typeof c.env.EMAIL_FROM === "string" && c.env.EMAIL_FROM.trim()) {
    payload.EMAIL_FROM = c.env.EMAIL_FROM.trim();
  }
  if (typeof c.env.INTERNAL_AUTH_SECRET === "string" && c.env.INTERNAL_AUTH_SECRET.trim()) {
    payload.INTERNAL_AUTH_SECRET = c.env.INTERNAL_AUTH_SECRET.trim();
  }
  if (typeof c.env.DATABASE_URL === "string" && c.env.DATABASE_URL.trim()) {
    payload.DATABASE_URL = c.env.DATABASE_URL.trim();
    bindWorkerDatabaseUrl(payload.DATABASE_URL);
  }
  bindCloudflareEnv(payload);
}

const router = Router();

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const prod = process.env["NODE_ENV"] === "production";

const sessionCookieOptions = {
  httpOnly: true,
  secure: prod,
  sameSite: prod ? ("none" as const) : ("lax" as const),
  path: "/" as const,
  maxAge: COOKIE_MAX_AGE * 1000,
};

/** Returns true when magic-link auth is explicitly enabled via env var. Default: disabled. */
function isMagicLinkEnabled(): boolean {
  return process.env.ENABLE_MAGIC_LINK_AUTH === "true";
}

function magicLinkDisabledResponse(res: Response): void {
  failure(
    res,
    "FEATURE_DISABLED",
    "Magic link login is not available. Please use email and password.",
    403,
  );
}

function postVerifyRedirectPath(onboardingComplete: boolean): string {
  return onboardingComplete ? "/dashboard" : "/onboarding";
}

const verifySchema = z.object({ token: z.string(), email: z.email() });

async function completeMagicLinkVerify(
  req: Request,
  res: Response,
  token: string,
  email: string,
  redirectOnSuccess?: boolean,
): Promise<void> {
  const verifyAllowed = await magicLinkVerifyLimit(email);
  if (!verifyAllowed) {
    const rateMsg = "Too many verification attempts. Try again later.";
    if (redirectOnSuccess) {
      const q = new URLSearchParams({ error: rateMsg });
      res.redirect(302, `${resolveAppUrl()}/auth/callback?${q.toString()}`);
      return;
    }
    failure(res, "RATE_LIMITED", rateMsg, 429, { retryable: true });
    return;
  }

  const { sessionToken, user } = await verifyMagicLink(token, email);
  res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);

  const redirectTo = postVerifyRedirectPath(user.onboardingComplete);

  if (redirectOnSuccess) {
    res.redirect(302, `${resolveAppUrl()}${redirectTo}`);
    return;
  }

  success(res, { user, verified: true, redirectTo });
}

// POST /api/auth/login — legacy magic-link bootstrap (disabled by default)
router.post("/login", async (req, res) => {
  if (!isMagicLinkEnabled()) {
    magicLinkDisabledResponse(res);
    return;
  }
  try {
    const schema = z.object({ email: z.email() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "Invalid email", 422);
      return;
    }
    const allowed = await magicLinkHourlyLimit(result.data.email);
    if (!allowed) {
      failure(res, "RATE_LIMITED", "Too many login attempts. Try again later.", 429, {
        retryable: true,
      });
      return;
    }
    const data = await sendMagicLink(result.data.email);
    success(res, { ...data, message: "magic_link_sent" });
  } catch (err) {
    handleError(req, res, err);
  }
});

function wantsHtmlRedirect(req: Request): boolean {
  const accept = String(req.headers.accept ?? "");
  return accept.includes("text/html") || accept === "*/*" || accept === "";
}

function redirectVerifyError(_req: Request, res: Response, message: string): void {
  const q = new URLSearchParams({ error: message });
  res.redirect(302, `${resolveAppUrl()}/auth/callback?${q.toString()}`);
}

// GET /api/auth/verify — legacy magic-link browser callback (disabled by default)
router.get("/verify", async (req, res) => {
  const htmlFlow = wantsHtmlRedirect(req);
  if (!isMagicLinkEnabled()) {
    if (htmlFlow) {
      redirectVerifyError(req, res, "Magic link login is disabled. Please use email and password.");
      return;
    }
    magicLinkDisabledResponse(res);
    return;
  }
  try {
    const parsed = verifySchema.safeParse({
      token: req.query.token,
      email: req.query.email,
    });
    if (!parsed.success) {
      if (htmlFlow) {
        redirectVerifyError(req, res, "This sign-in link is invalid or incomplete.");
        return;
      }
      failure(res, "VALIDATION_ERROR", "Invalid verify query", 422);
      return;
    }
    await completeMagicLinkVerify(req, res, parsed.data.token, parsed.data.email, htmlFlow);
  } catch (err) {
    if (htmlFlow) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Verification failed or this link has expired.";
      redirectVerifyError(req, res, message);
      return;
    }
    handleError(req, res, err);
  }
});

// POST /api/auth/send-magic-link and /api/auth/magic-link/send (disabled by default)
router.post("/send-magic-link", handleSendMagicLink);
router.post("/magic-link/send", handleSendMagicLink);

async function handleSendMagicLink(req: Request, res: Response): Promise<void> {
  if (!isMagicLinkEnabled()) {
    magicLinkDisabledResponse(res);
    return;
  }
  try {
    const c = magicLinkWorkerContext(req);
    bindMagicLinkWorkerSecrets(c);

    const schema = z.object({ email: z.email() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "email");
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      failure(res, "VALIDATION_ERROR", "Invalid email", 422, { fieldErrors });
      return;
    }
    const allowed = await magicLinkHourlyLimit(result.data.email);
    if (!allowed) {
      failure(res, "RATE_LIMITED", "Too many login attempts. Try again later.", 429, {
        retryable: true,
      });
      return;
    }
    const data = await sendMagicLink(result.data.email);
    success(res, data);
  } catch (err) {
    handleError(req, res, err);
  }
}

// POST /api/auth/verify — legacy JSON verify (disabled by default)
router.post("/verify", async (req, res) => {
  if (!isMagicLinkEnabled()) {
    magicLinkDisabledResponse(res);
    return;
  }
  try {
    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "Invalid request", 422);
      return;
    }
    await completeMagicLinkVerify(req, res, result.data.token, result.data.email, false);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/auth/session — returns Supabase user + TORGIMA profile
// Works with both Supabase JWT (Authorization: Bearer) and legacy session cookie.
router.get("/session", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");
    if (!auth.userId) {
      success(res, { authenticated: false, user: null });
      return;
    }

    // Load full profile; fall back to auth-context defaults if blueprint/extra queries fail.
    let user;
    try {
      user = await getUser(auth.userId);
    } catch (err) {
      const log = req.log ?? logger;
      log.warn(
        { err: err instanceof Error ? err.message : String(err), userId: auth.userId },
        "[auth/session] getUser failed — returning minimal profile from auth context",
      );
      user = {
        id: auth.userId,
        email: auth.email ?? "",
        displayName: null,
        mode: auth.userMode,
        tier: auth.userTier,
        onboardingComplete: false,
        executionState: "NORMAL",
        firstLoginAfterUpgrade: false,
        activeBlueprintId: null,
        timezone: "UTC",
        notificationPreferences: {},
        dashboardMode: auth.dashboardMode ?? "limited",
        erectorTier: auth.erectorTier ?? null,
      };
    }

    const session = buildSessionResponse(auth, user);

    success(res, {
      ...session,
      authenticated: true,
      userId: auth.userId,
      sessionId: auth.sessionId,
      userMode: auth.userMode,
      userTier: auth.userTier,
      user,
    });
  } catch (err) {
    // Profile sync or token verification failure — structured error with CORS + requestId.
    handleError(req, res, err);
  }
});

// POST /api/auth/sign-out — Supabase sessions are client-side JWT; frontend calls supabase.auth.signOut()
// This endpoint exists for completeness and to clear any legacy session cookie.
router.post("/sign-out", async (req, res) => {
  try {
    const cookies = req.cookies as Record<string, string | undefined>;
    const sessionToken = cookies[SESSION_COOKIE_NAME];
    if (sessionToken) {
      await revokeSession(sessionToken).catch(() => null);
    }
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      secure: prod,
      sameSite: prod ? "none" : "lax",
    });
    success(res, { signedOut: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/auth/logout — alias for sign-out (backwards compat)
router.post("/logout", async (req, res) => {
  try {
    const cookies = req.cookies as Record<string, string | undefined>;
    const sessionToken = cookies[SESSION_COOKIE_NAME];
    if (sessionToken) {
      await revokeSession(sessionToken).catch(() => null);
    }
    res.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      secure: prod,
      sameSite: prod ? "none" : "lax",
    });
    success(res, { loggedOut: true });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
