import { logger } from "../lib/logger.js";
import { getUser } from "./AuthService.js";
import { BlueprintService } from "./BlueprintService.js";
import { OrderService } from "./OrderService.js";
import { FeedbackService } from "./FeedbackService.js";
import { SignalService } from "./SignalService.js";
import {
  db,
  blueprints,
  orders,
  pivotReviews,
  conditions,
  signalSnapshots,
  systemHealthLogs,
  featureFlags as featureFlagsTable,
  falseProgressFlags,
  validations,
} from "@workspace/db";
import { checkAssumptionDrift } from "../engines/validation/AssumptionMonitoringService.js";
import { buildDashboardAlerts, deriveDashboardUiState } from "./DashboardUiState.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  deriveExecutionIdentityLines,
  deriveOperationalAwarenessLines,
  deriveSignalBlueprintBridgeLines,
} from "../lib/operationalDerivation.js";

export const DashboardService = {
  async getDashboardState(userId: string) {
    logger.info({ userId }, "DashboardService.getDashboardState");

    const [user, userBlueprints, activeOrders, signals, recentFeedback, primaryTask] = await Promise.all([
      getUser(userId),
      BlueprintService.list(userId),
      OrderService.getActive(userId),
      SignalService.getCurrent(userId),
      FeedbackService.getRecent(userId, 5),
      OrderService.getPrimaryDashboardTask(userId),
    ]);

    const activeBlueprint = userBlueprints.find((b) => b.status === "active") ?? null;
    /** When execution just finished there is often no longer an "active" row — surface completion UI briefly. */
    let recentCompletionBlueprint: (typeof userBlueprints)[number] | null = null;
    if (!activeBlueprint) {
      const completed = userBlueprints.filter((b) => b.status === "complete");
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
    let economyIntelligence: {
      archetypeName?: string | null;
      realityScore?: number | null;
      warning?: string | null;
      opportunity?: string | null;
      reportHref?: string;
    } | null = null;
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
      transitionReason?: string | null;
      previousCondition?: string | null;
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

    let operationalAwareness: string[] = [];
    let signalBlueprintBridge: Array<{ headline: string; cite: string }> = [];
    let executionIdentityLines: string[] = [];
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
          .select({ state_version: blueprints.state_version })
          .from(blueprints)
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
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
          transitionReason: conditionRow.transition_reason,
          previousCondition: conditionRow.previous_condition,
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

      const enforcementPerm =
        enforcementProjection && typeof enforcementProjection.phasePermission === "string" ?
          enforcementProjection.phasePermission
        : null;
      const diffCap =
        enforcementProjection && typeof enforcementProjection.difficultyCap === "string" ?
          enforcementProjection.difficultyCap
        : null;

      const condEffective = conditionDetail ?? {
        condition: signals.condition,
        durationDays: 0,
        recoveryRequired: false,
        escalationLevel: 0,
        transitionReason: null as string | null,
        previousCondition: null as string | null,
      };

      signalBlueprintBridge = deriveSignalBlueprintBridgeLines({
        condition: {
          condition: condEffective.condition,
          durationDays: condEffective.durationDays,
          recoveryRequired: condEffective.recoveryRequired,
          escalationLevel: condEffective.escalationLevel,
          transitionReason:
            typeof condEffective.transitionReason === "string" ? condEffective.transitionReason : null,
          previousCondition:
            typeof condEffective.previousCondition === "string" ? condEffective.previousCondition : null,
        },
        signalProjection,
        enforcementPhasePermission: enforcementPerm,
        difficultyCap: diffCap,
        pivotReviewOpen,
      });

      operationalAwareness = deriveOperationalAwarenessLines({
        condition: {
          condition: condEffective.condition,
          durationDays: condEffective.durationDays,
          recoveryRequired: condEffective.recoveryRequired,
          escalationLevel: condEffective.escalationLevel,
          transitionReason:
            typeof condEffective.transitionReason === "string" ? condEffective.transitionReason : null,
          previousCondition:
            typeof condEffective.previousCondition === "string" ? condEffective.previousCondition : null,
        },
        signalProjection,
        enforcementPhasePermission: enforcementPerm,
        pivotReviewOpen,
        hasBlockedOrders: activeOrders.some((o) => o.status === "blocked"),
        lockedPhaseCount: 0,
      });

      executionIdentityLines = deriveExecutionIdentityLines({
        momentumStreakDays: signals.streak,
        feedbackCyclesThisWeek: completedThisWeek,
        completedOrdersAllTime: 0,
        operatingPattern: null,
      });
    } else {
      const ffRows = await db.select().from(featureFlagsTable);
      for (const row of ffRows) {
        featureFlagMap[row.feature_name] = row.enabled;
      }
    }

    let hasAwaitingFeedbackOrder = false;
    if (blueprintId) {
      const [awaitingRow] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.blueprint_id, blueprintId),
            eq(orders.user_id, userId),
            inArray(orders.status, ["needs_feedback", "needs_proof"]),
          ),
        )
        .limit(1);
      hasAwaitingFeedbackOrder = Boolean(awaitingRow);
    }

    const hasBlockedOrder = activeOrders.some((o) => o.status === "blocked");
    const hasPendingOrActiveTask = Boolean(primaryTask);

    const condEffective = conditionDetail ?? {
      condition: signals.condition,
      durationDays: 0,
      recoveryRequired: false,
      escalationLevel: 0,
      transitionReason: null as string | null,
      previousCondition: null as string | null,
    };

    const dashboardUiState = deriveDashboardUiState({
      hasBlueprint: Boolean(activeBlueprint),
      blueprintStatus: activeBlueprint?.status ?? null,
      systemOperational: health.systemOperational,
      condition: condEffective.condition,
      recoveryRequired: condEffective.recoveryRequired,
      currentActionStatus: primaryTask?.status ?? null,
      currentActionTaskType: primaryTask?.taskType ?? null,
      hasAwaitingFeedbackOrder,
      hasBlockedOrder,
      hasPendingOrActiveTask,
    });

    let assumptionDrift: Awaited<ReturnType<typeof checkAssumptionDrift>> = [];
    let openFalseProgressCount = 0;
    if (blueprintId) {
      const [fpCount] = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(falseProgressFlags)
        .where(
          and(
            eq(falseProgressFlags.blueprint_id, blueprintId),
            eq(falseProgressFlags.resolved, false),
          ),
        );
      openFalseProgressCount = fpCount?.c ?? 0;

      const [valRow] = await db
        .select({
          id: validations.id,
          created_at: validations.created_at,
          reality_score: validations.reality_score,
          archetype_resolution: validations.archetype_resolution,
          economy_briefing: validations.economy_briefing,
        })
        .from(validations)
        .where(eq(validations.blueprint_id, blueprintId))
        .orderBy(desc(validations.created_at))
        .limit(1);

      const briefing = valRow?.economy_briefing as { keyWarnings?: string[]; keyOpportunities?: string[] } | null;
      const resolution = valRow?.archetype_resolution as { primaryArchetype?: { name?: string } } | null;
      economyIntelligence = valRow ? {
        archetypeName: resolution?.primaryArchetype?.name ?? null,
        realityScore: valRow.reality_score ?? null,
        warning: briefing?.keyWarnings?.[0] ?? null,
        opportunity: briefing?.keyOpportunities?.[0] ?? null,
        reportHref: `/validation/${valRow.id}`,
      } : null;

      const daysSinceValidation = valRow?.created_at
        ? (Date.now() - valRow.created_at.getTime()) / 86400000
        : 0;

      assumptionDrift = await checkAssumptionDrift({
        userId,
        blueprintId,
        daysSinceValidation,
        condition: condEffective.condition,
        completionRate: signalProjection?.completionRate ?? signals.consistency,
      }).catch(() => []);
    }

    const alerts = buildDashboardAlerts({
      uiState: dashboardUiState,
      hasBlockedOrder,
      recoveryRequired: condEffective.recoveryRequired,
      pivotReviewOpen,
      healthMessage: health.message,
      assumptionDrift: assumptionDrift.map((w) => ({
        assumptionId: w.assumptionId,
        message: w.message,
        severity: w.severity,
      })),
      openFalseProgressCount,
    });

    return {
      user,
      signals,
      activeBlueprint: activeBlueprint ? { ...activeBlueprint, economyIntelligence } : activeBlueprint,
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
      conditionDetail: condEffective,
      signalProjection,
      enforcement: enforcementProjection,
      currentAction: primaryTask,
      health,
      featureFlags: featureFlagMap,
      operationalAwareness,
      signalBlueprintBridge,
      executionIdentityLines,
      dashboardUiState,
      pendingSync: dashboardUiState === "PENDING_SYNC",
      alerts,
    };
  },
};
