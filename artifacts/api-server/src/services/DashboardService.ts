import { logger } from "../lib/logger.js";
import { getUser } from "./AuthService.js";
import { BlueprintService } from "./BlueprintService.js";
import { OrderService } from "./OrderService.js";
import { FeedbackService } from "./FeedbackService.js";
import { SignalService } from "./SignalService.js";
import {
  db,
  blueprints as blueprintsTable,
  pivotReviews,
  conditions,
  signalSnapshots,
  systemHealthLogs,
  featureFlags as featureFlagsTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

export const DashboardService = {
  async getDashboardState(userId: string) {
    logger.info({ userId }, "DashboardService.getDashboardState");

    const [user, blueprints, activeOrders, signals, recentFeedback, primaryTask] = await Promise.all([
      getUser(userId),
      BlueprintService.list(userId),
      OrderService.getActive(userId),
      SignalService.getCurrent(userId),
      FeedbackService.getRecent(userId, 5),
      OrderService.getPrimaryDashboardTask(userId),
    ]);

    const activeBlueprint = blueprints.find((b) => b.status === "active") ?? null;
    /** When execution just finished there is often no longer an "active" row — surface completion UI briefly. */
    let recentCompletionBlueprint: (typeof blueprints)[number] | null = null;
    if (!activeBlueprint) {
      const completed = blueprints.filter((b) => b.status === "complete");
      const sorted = [...completed].sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      });
      const top = sorted[0];
      if (top?.completedAt) {
        const ageMs = Date.now() - new Date(top.completedAt).getTime();
        if (ageMs >= 0 && ageMs <= 72 * 60 * 60 * 1000) recentCompletionBlueprint = top;
      }
    }

    const blueprintId = activeBlueprint?.id ?? null;

    const completedToday = recentFeedback.filter((f) => {
      const today = new Date().toDateString();
      return new Date(f.createdAt).toDateString() === today;
    }).length;

    const completedThisWeek = recentFeedback.filter((f) => {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return new Date(f.createdAt).getTime() > weekAgo;
    }).length;

    let stateVersion = primaryTask?.stateVersion ?? 0;
    let pivotReviewOpen = false;
    let pivotReviewId: string | null = null;
    let pivotReview: {
      id: string;
      triggerType: string;
      triggerReason: string;
      conditionAtTrigger: string | null;
      pathOptions: unknown;
      status: string;
      createdAt: Date;
    } | null = null;

    let conditionDetail: {
      condition: string;
      durationDays: number;
      recoveryRequired: boolean;
      escalationLevel: number;
    } | null = null;

    let signalProjection: {
      completionRate: number;
      weightedScore: number;
      momentum: number;
      trend: string | null;
      confidence: string | null;
      blockerRatio: number | null;
      skipRatio: number | null;
    } | null = null;

    let enforcementProjection: Record<string, unknown> | null = null;
    let health: { systemOperational: boolean; message?: string } = { systemOperational: true };
    const featureFlagMap: Record<string, boolean> = {};

    if (blueprintId) {
      const [openPivot, conditionRow, snapRow, critHealthRows, ffRows] = await Promise.all([
        db
          .select()
          .from(pivotReviews)
          .where(
            and(
              eq(pivotReviews.blueprint_id, blueprintId),
              eq(pivotReviews.user_id, userId),
              eq(pivotReviews.status, "open"),
            ),
          )
          .limit(1)
          .then((r) => r[0] ?? null),

        db
          .select()
          .from(conditions)
          .where(and(eq(conditions.blueprint_id, blueprintId), eq(conditions.is_current, true)))
          .limit(1)
          .then((r) => r[0] ?? null),

        db
          .select()
          .from(signalSnapshots)
          .where(
            and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)),
          )
          .limit(1)
          .then((r) => r[0] ?? null),

        db
          .select({ id: systemHealthLogs.id, details_json: systemHealthLogs.details_json })
          .from(systemHealthLogs)
          .where(
            and(
              eq(systemHealthLogs.blueprint_id, blueprintId),
              eq(systemHealthLogs.status, "degraded"),
              inArray(systemHealthLogs.check_type, ["FATAL", "CRITICAL"]),
            ),
          )
          .limit(3),

        db.select().from(featureFlagsTable),
      ]);

      if (!primaryTask) {
        const [bpVer] = await db
          .select({ state_version: blueprintsTable.state_version })
          .from(blueprintsTable)
          .where(and(eq(blueprintsTable.id, blueprintId), eq(blueprintsTable.user_id, userId)))
          .limit(1);
        stateVersion = bpVer?.state_version ?? 0;
      }

      if (openPivot) {
        pivotReviewOpen = true;
        pivotReviewId = openPivot.id;
        pivotReview = {
          id: openPivot.id,
          triggerType: openPivot.trigger_type,
          triggerReason: openPivot.trigger_reason,
          conditionAtTrigger: openPivot.condition_at_trigger,
          pathOptions: openPivot.path_options_json,
          status: openPivot.status,
          createdAt: openPivot.created_at,
        };
      }

      if (conditionRow) {
        conditionDetail = {
          condition: conditionRow.condition,
          durationDays: conditionRow.duration_days,
          recoveryRequired: conditionRow.recovery_required,
          escalationLevel: conditionRow.escalation_level,
        };
      }

      if (snapRow) {
        signalProjection = {
          completionRate: Number(snapRow.completion_rate),
          weightedScore: Number(snapRow.weighted_score),
          momentum: Number(snapRow.momentum),
          trend: snapRow.trend ?? null,
          confidence: snapRow.confidence ?? null,
          blockerRatio: snapRow.blocker_ratio != null ? Number(snapRow.blocker_ratio) : null,
          skipRatio: snapRow.skip_ratio != null ? Number(snapRow.skip_ratio) : null,
        };
      }

      try {
        const stateView = await BlueprintService.getStateView(blueprintId, userId);
        if (stateView.enforcement) enforcementProjection = stateView.enforcement as Record<string, unknown>;
      } catch {
        enforcementProjection = null;
      }

      if (critHealthRows.length > 0) {
        health = {
          systemOperational: false,
          message: "Critical system checks reported — execution safeguards may apply.",
        };
      }

      for (const row of ffRows) {
        featureFlagMap[row.feature_name] = row.enabled;
      }
    } else {
      const ffRows = await db.select().from(featureFlagsTable);
      for (const row of ffRows) {
        featureFlagMap[row.feature_name] = row.enabled;
      }
    }

    return {
      user,
      signals,
      activeBlueprint,
      recentCompletionBlueprint,
      activeOrders,
      recentFeedback,
      streakDays: signals.streak,
      tasksCompletedToday: completedToday,
      tasksCompletedThisWeek: completedThisWeek,
      // Prompt 15 — consolidated projection fields
      stateVersion,
      pivotReviewOpen,
      pivotReviewId,
      pivotReview,
      conditionDetail: conditionDetail ?? { condition: signals.condition, durationDays: 0, recoveryRequired: false, escalationLevel: 0 },
      signalProjection,
      enforcement: enforcementProjection,
      currentAction: primaryTask,
      health,
      featureFlags: featureFlagMap,
    };
  },
};
