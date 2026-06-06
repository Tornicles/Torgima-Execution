import { Router } from "express";
import { z } from "zod/v4";
import { db, waitlist } from "@workspace/db";
import { success, failure, handleError } from "../lib/utils.js";
import { checkRateLimit } from "../monitoring/rateLimiter.js";

const router = Router();

const joinSchema = z.object({
  email: z.email(),
  name: z.string().max(120).optional(),
  goal: z.string().max(500).optional(),
  source: z.string().max(64).optional(),
});

// POST /api/waitlist — public early-access signup
router.post("/waitlist", async (req, res) => {
  try {
    const allowed = await checkRateLimit(`waitlist:${req.ip ?? "unknown"}`, 3, 60_000);
    if (!allowed) {
      failure(res, "RATE_LIMITED", "Too many requests. Try again in a minute.", 429, {
        retryable: true,
      });
      return;
    }

    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "INVALID_EMAIL", "Please enter a valid email address.", 400);
      return;
    }

    await db
      .insert(waitlist)
      .values({
        email: parsed.data.email.toLowerCase().trim(),
        name: parsed.data.name?.trim(),
        goal: parsed.data.goal?.trim(),
        source: parsed.data.source?.trim() ?? "website",
      })
      .onConflictDoNothing();

    success(res, { message: "You're on the list. We'll be in touch soon." });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
