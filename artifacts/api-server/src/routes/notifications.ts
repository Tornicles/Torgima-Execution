import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import { success, handleError } from "../lib/utils.js";
import {
  processUnsubscribe,
} from "../services/NotificationService.js";
import { db, notificationLogs } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router = Router();

const APP_PUBLIC_URL =
  process.env["PUBLIC_APP_URL"] ??
  process.env["NEXT_PUBLIC_APP_URL"] ??
  process.env["APP_URL"] ??
  "http://localhost:3000";

// GET /api/notifications/unsubscribe — no session; redirects to app unsubscribe UI
router.get("/notifications/unsubscribe", async (req, res) => {
  try {
    const raw = req.query["token"];
    let token: string | undefined;
    if (typeof raw === "string") token = raw;
    else if (Array.isArray(raw) && typeof raw[0] === "string") token = raw[0];

    if (!token) {
      res.redirect(302, `${APP_PUBLIC_URL}/notifications/unsubscribe?error=invalid`);
      return;
    }

    const result = await processUnsubscribe(token);

    if (!result.success) {
      res.redirect(302, `${APP_PUBLIC_URL}/notifications/unsubscribe?error=expired`);
      return;
    }

    const qs = new URLSearchParams({
      success: "true",
      type: result.notificationType ?? "all",
      global: result.isGlobal ? "true" : "false",
    });
    res.redirect(302, `${APP_PUBLIC_URL}/notifications/unsubscribe?${qs.toString()}`);
  } catch (err) {
    handleError(req, res, err);
  }
});

// GET /api/notifications/history
router.get("/notifications/history", async (req, res) => {
  try {
    const auth = await requireAuth(req, "USER_SESSION");
    const logs = await db
      .select({
        id: notificationLogs.id,
        notification_type: notificationLogs.notification_type,
        channel: notificationLogs.channel,
        status: notificationLogs.status,
        suppression_reason: notificationLogs.suppression_reason,
        sent_at: notificationLogs.sent_at,
        created_at: notificationLogs.created_at,
      })
      .from(notificationLogs)
      .where(eq(notificationLogs.user_id, auth.userId))
      .orderBy(desc(notificationLogs.created_at))
      .limit(20);

    success(res, { logs });
  } catch (err) {
    handleError(req, res, err);
  }
});

export default router;
