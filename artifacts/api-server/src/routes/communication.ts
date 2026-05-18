import { Router } from "express";
import { z } from "zod";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { success, failure, handleError } from "../lib/utils.js";
import { filterForUser } from "../bhudhi/AdaptiveCommunicationEngine.js";

const router = Router();

const filterBodySchema = z.object({
  content: z.union([z.string(), z.record(z.unknown())]),
  outputType: z.string().optional(),
  userCondition: z.string().optional(),
  confidenceTier: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
});

router.post("/communication/filter", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = filterBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid input", 422);
      return;
    }

    const filtered = await filterForUser(parsed.data.content, {
      userId: auth.userId,
      outputType: parsed.data.outputType,
      userCondition: parsed.data.userCondition,
      confidenceTier: parsed.data.confidenceTier,
    });

    success(res, filtered);
  } catch (err) {
    handleError(req, res, err);
  }
});

const profileBodySchema = z.object({
  tone: z.enum(["direct", "standard", "warm"]).optional(),
  detailLevel: z.enum(["brief", "standard", "detailed"]).optional(),
});

router.patch("/me/communication-profile", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = profileBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid profile", 422);
      return;
    }

    const [user] = await db
      .select({ communication_profile: users.communication_profile })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const current = (user?.communication_profile as Record<string, unknown>) ?? {};
    const next = { ...current, ...parsed.data };

    await db
      .update(users)
      .set({ communication_profile: next })
      .where(eq(users.id, auth.userId));

    success(res, { communicationProfile: next });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
