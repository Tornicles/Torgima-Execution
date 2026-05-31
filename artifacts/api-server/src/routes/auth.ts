import { Router } from "express";
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
    const data = await sendMagicLink(result.data.email);
    success(res, data);
  } catch (err) {
    handleError(req, res, err);
  }
});

// POST /api/auth/verify
router.post("/verify", async (req, res) => {
  try {
    const schema = z.object({ token: z.string(), email: z.email() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "Invalid request", 422);
      return;
    }
    const email = result.data.email;
    const verifyAllowed = await magicLinkVerifyLimit(email);
    if (!verifyAllowed) {
      failure(res, "RATE_LIMITED", "Too many verification attempts. Try again later.", 429, {
        retryable: true,
      });
      return;
    }
    const { sessionToken, user } = await verifyMagicLink(result.data.token, email);

    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions);

    success(res, { user });
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/auth/session
router.get("/session", async (req, res) => {
  try {
    const auth = await requireAuth(req, "OPTIONAL_SESSION");
    if (!auth.userId) {
      success(res, { authenticated: false, user: null });
      return;
    }
    const user = await getUser(auth.userId);
    success(res, { authenticated: true, user });
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
