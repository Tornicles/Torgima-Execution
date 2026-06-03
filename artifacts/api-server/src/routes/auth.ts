import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  sendMagicLink,
  verifyMagicLink,
  revokeSession,
  getUser,
} from "../services/AuthService.js";
import { requireAuth } from "../lib/auth.js";
import { SESSION_COOKIE_NAME } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { resolveAppUrl } from "../lib/app-url.js";
import {
  magicLinkHourlyLimit,
  magicLinkVerifyLimit,
} from "../middleware/apiRateLimit.js";

const router = Router();

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds
const prod = process.env["NODE_ENV"] === "production";

const sessionCookieOptions = {
  httpOnly: true,
  secure: prod,
  sameSite: prod ? ("none" as const) : ("lax" as const),
  path: "/" as const,
  maxAge: COOKIE_MAX_AGE * 1000,
};

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
    failure(res, "RATE_LIMITED", "Too many verification attempts. Try again later.", 429, {
      retryable: true,
    });
    return;
  }

  const { sessionToken, user } = await verifyMagicLink(token, email);
  res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);

  if (redirectOnSuccess) {
    const base = resolveAppUrl();
    const target = user.onboardingComplete ? `${base}/dashboard` : `${base}/onboarding`;
    res.redirect(302, target);
    return;
  }

  success(res, { user, verified: true });
}

// POST /api/auth/login — DOC 30 magic-link bootstrap
router.post("/login", async (req, res) => {
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

// GET /api/auth/verify — browser magic-link landing (redirect after cookie)
router.get("/verify", async (req, res) => {
  try {
    const parsed = verifySchema.safeParse({
      token: req.query.token,
      email: req.query.email,
    });
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid verify query", 422);
      return;
    }
    const accept = String(req.headers.accept ?? "");
    const wantsHtml = accept.includes("text/html");
    await completeMagicLinkVerify(
      req,
      res,
      parsed.data.token,
      parsed.data.email,
      wantsHtml,
    );
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/auth/send-magic-link
router.post("/send-magic-link", async (req, res) => {
  try {
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
});

// POST /api/auth/verify
router.post("/verify", async (req, res) => {
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

// GET /api/auth/session — DOC 30 session status
router.get("/session", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");
    if (!auth.userId) {
      success(res, { authenticated: false, user: null });
      return;
    }
    const user = await getUser(auth.userId);
    success(res, {
      authenticated: true,
      userId: auth.userId,
      sessionId: auth.sessionId,
      userMode: auth.userMode,
      userTier: auth.userTier,
      user,
    });
  } catch {
    success(res, { authenticated: false, user: null });
  }
});

// POST /api/auth/logout
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
