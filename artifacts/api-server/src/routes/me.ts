import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../lib/auth.js";
import { getUser, updateUserSettings } from "../services/AuthService.js";
import { success, failure, handleError } from "../lib/utils.js";
import { getMergedNotificationPreferences } from "../services/NotificationService.js";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../constants/notifications.js";

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

const notificationPrefsSchema = z
  .object({
    email_inactivity_reminder: z.boolean().optional(),
    email_milestone_achieved: z.boolean().optional(),
    email_blueprint_completed: z.boolean().optional(),
    email_pivot_review_ready: z.boolean().optional(),
    email_blueprint_paused: z.boolean().optional(),
    email_weekly_summary: z.boolean().optional(),
    email_all_disabled: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .strict();

// GET /api/me/notification-preferences
router.get("/me/notification-preferences", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const prefs = await getMergedNotificationPreferences(auth.userId);
    success(res, prefs);
  } catch (err) {
    handleError(req, res, err);
  }
});

// PATCH /api/me/notification-preferences
router.patch("/me/notification-preferences", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const parsed = notificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      failure(res, "VALIDATION_ERROR", "Invalid preferences", 400);
      return;
    }

    const [userRow] = await db
      .select({ notification_preferences: users.notification_preferences })
      .from(users)
      .where(eq(users.id, auth.userId))
      .limit(1);

    const currentPrefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(typeof userRow?.notification_preferences === "object" && userRow.notification_preferences !== null
        ? (userRow.notification_preferences as Record<string, unknown>)
        : {}),
    };

    const updatedPrefs = { ...currentPrefs, ...parsed.data };

    await db
      .update(users)
      .set({ notification_preferences: updatedPrefs })
      .where(eq(users.id, auth.userId));

    success(res, { updated: true, preferences: updatedPrefs });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
