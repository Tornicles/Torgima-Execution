import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { getUser, updateUserSettings } from "../services/AuthService.js";
import { success, failure, handleError } from "../lib/utils.js";

const router = Router();

// GET /api/me
router.get("/me", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const user = await getUser(auth.userId);
    success(res, user);
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/me
router.patch("/me", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z.object({
      display_name: z.string().min(1).max(100).optional(),
      timezone: z.string().optional(),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      failure(res, "VALIDATION_ERROR", "Invalid request body", 422);
      return;
    }
    const user = await updateUserSettings(auth.userId, result.data);
    success(res, user);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/me/settings
router.get("/me/settings", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const user = await getUser(auth.userId);
    success(res, {
      displayName: user.displayName,
      timezone: user.timezone,
      notificationPreferences: user.notificationPreferences,
    });
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/me/settings
router.patch("/me/settings", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const schema = z
      .object({
        display_name: z.string().min(1).max(100).optional(),
        timezone: z.string().optional(),
        commitment_level: z.enum(["low", "medium", "high", "full"]).optional(),
        notification_preferences: z.record(z.string(), z.unknown()).optional(),
      })
      .strict();
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "field");
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      failure(res, "VALIDATION_ERROR", "Invalid settings", 422, { fieldErrors });
      return;
    }
    const user = await updateUserSettings(auth.userId, result.data);
    success(res, { updated: true, displayName: user.displayName });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
