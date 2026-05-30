import { logger } from "../lib/logger.js";
import { getUser } from "./AuthService.js";
import { BlueprintService } from "./BlueprintService.js";
import { OrderService } from "./OrderService.js";
import { FeedbackService } from "./FeedbackService.js";
import { SignalService } from "./SignalService.js";
import {
  db,
  blueprints,
  economicArchetypes,
  orders,
  pivotReviews,
  conditions,
  signalSnapshots,
  systemHealthLogs,
  featureFlags as featureFlagsTable,
  falseProgressFlags,
  validations,
  academyTasks,
  phases,
  frameworkActivations,
  frameworkDecisions,
} from "@workspace/db";
import { checkAssumptionDrift } from "../engines/validation/AssumptionMonitoringService.js";
import { buildDashboardAlerts, deriveDashboardUiState } from "./DashboardUiState.js";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  deriveExecutionIdentityLines,
  deriveOperationalAwarenessLines,
  deriveSignalBlueprintBridgeLines,
} from "../lib/operationalDerivation.js";
import { BlueprintStatus, OrderStatus, PivotReviewStatus, SystemHealthStatus } from "@workspace/state-machine";
import { fetchDashboardIntelligence } from "../bhudhi/AdvancedIntelligenceBridge.js";
import {
  getCurrentIdentityState,
  toDashboardIdentity,
} from "../engines/intelligence/IdentityContinuityEngine.js";
import { PredictiveIntelligenceService } from "../bhudhi/PredictiveIntelligenceService.js";
import { ExternalIntelligenceService } from "../bhudhi/ExternalIntelligenceService.js";
import { getLatestRewardForBlueprint } from "../engines/reward/RewardEngine.js";
import { checkOutcomeIntegrity, getOpenFlags } from "../engines/outcome/OutcomeValidationEngine.js";
import { evaluatePhaseReadiness } from "../engines/blueprint/PhaseProgressionEngine.js";
import { mapStarterSignalLabel } from "./TierDifferentiationService.js";
import { buildHomeDashboardPanels } from "../lib/homeDashboardPanels.js";

async function buildNoActiveBlueprintDashboardState(userId: string) {
  const [user, signals, recentFeedback, activeOrders] = await Promise.all([
    getUser(userId),
    SignalService.getCurrent(userId),
    FeedbackService.getRecent(userId, 5).catch(() => []),
    OrderService.getActive(userId).catch(() => []),
  ]);

  const condEffective = {
    condition: signals.condition,
    durationDays: 0,
    recoveryRequired: false,
    escalationLevel: 0,
    transitionReason: null as string | null,
    previousCondition: null as string | null,
  };

  const dashboardUiState = deriveDashboardUiState({
    hasBlueprint: false,
    blueprintStatus: null,
    systemOperational: true,
    condition: condEffective.condition,
    recoveryRequired: false,
    currentActionStatus: null,
    currentActionTaskType: null,
    hasAwaitingFeedbackOrder: false,
    hasBlockedOrder: false,
    hasPendingOrActiveTask: false,
  });

  return {
    hasActiveBlueprint: false,
    state: "NO_ACTIVE_BLUEPRINT" as const,
    user,
    identity: {
      stage: null,
      label: null,
      summary: null,
      lastEvaluatedAt: null,
    },
    latestReward: null,
    outcomeIntegrity: { openFlags: [], canAdvancePhase: true, blockers: [] },
    phaseReadiness: null,
    academyTasks: { pending: [], blocksExecution: false },
    frameworks: { active: [], hasEnforcedDecision: false },
    simplifiedSignalLabel: null,
    signals,
    activeBlueprint: null,
    recentCompletionBlueprint: null,
    activeOrders,
    recentFeedback,
    streakDays: signals.streak,
    tasksCompletedToday: 0,
    tasksCompletedThisWeek: 0,
    stateVersion: 0,
    pivotReviewOpen: false,
    pivotReviewId: null,
    pivotReview: null,
    conditionDetail: condEffective,
    signalProjection: null,
    enforcement: null,
    currentAction: null,
    health: { systemOperational: true },
    featureFlags: {} as Record<string, boolean>,
    operationalAwareness: [] as string[],
    signalBlueprintBridge: [] as Array<{ headline: string; cite: string }>,
    executionIdentityLines: [] as string[],
    dashboardUiState,
    pendingSync: false,
    alerts: buildDashboardAlerts({
      uiState: dashboardUiState,
      hasBlockedOrder: false,
      recoveryRequired: false,
      pivotReviewOpen: false,
      assumptionDrift: [],
      openFalseProgressCount: 0,
    }),
    intelligence: {
      headline: "No active blueprint yet.",
      bodyText: "Complete validation and launch your direction to start execution.",
      nextActionSuggestion: "Review validation results or start a new idea in Erector.",
      fallbackUsed: true,
    },
    prediction: null,
    externalIntelligenceFreshness: "none" as const,
    homePanels: null,
  };
}

export const DashboardService = {
  async getDashboardState(userId: string) {
    logger.info({ userId }, "DashboardService.getDashboardState");

    const userBlueprints = await BlueprintService.list(userId);
    const activeBlueprint = userBlueprints.find((b) => b.status === BlueprintStatus.ACTIVE) ?? null;
    /** When execution just finished there is often no longer an "active" row — surface completion UI briefly. */
    let recentCompletionBlueprint: (typeof userBlueprints)[number] | null = null;
    if (!activeBlueprint) {
      const completed = userBlueprints.filter((b) => b.status === BlueprintStatus.COMPLETE);
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

    if (!activeBlueprint && !recentCompletionBlueprint) {
      return buildNoActiveBlueprintDashboardState(userId);
    }

    const [user, activeOrders, signals, recentFeedback, primaryTask] = await Promise.all([
      getUser(userId),
      OrderService.getActive(userId),
      SignalService.getCurrent(userId),
      FeedbackService.getRecent(userId, 5),
      OrderService.getPrimaryDashboardTask(userId),
    ]);

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
    let executionContext: {
      archetypeName: string | null;
      realityScore: number | null;
      blueprintTier: string | null;
      industryState: string | null;
      economyBriefingSummary: string | null;
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
              eq(pivotReviews.status, PivotReviewStatus.OPEN),
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
              eq(systemHealthLogs.status, SystemHealthStatus.DEGRADED),
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
        hasBlockedOrders: activeOrders.some((o) => o.status === OrderStatus.BLOCKED),
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
            inArray(orders.status, [OrderStatus.NEEDS_FEEDBACK, OrderStatus.NEEDS_PROOF]),
          ),
        )
        .limit(1);
      hasAwaitingFeedbackOrder = Boolean(awaitingRow);
    }

    const hasBlockedOrder = activeOrders.some((o) => o.status === OrderStatus.BLOCKED);
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

      const [bpIntelRow, valRow] = await Promise.all([
        db
          .select({
            primary_archetype_id: blueprints.primary_archetype_id,
            reality_score: blueprints.reality_score,
            blueprint_tier: blueprints.blueprint_tier,
            industry_state: blueprints.industry_state,
            economy_briefing_summary: blueprints.economy_briefing_summary,
            archetype_name: economicArchetypes.name,
          })
          .from(blueprints)
          .leftJoin(
            economicArchetypes,
            eq(blueprints.primary_archetype_id, economicArchetypes.id),
          )
          .where(and(eq(blueprints.id, blueprintId), eq(blueprints.user_id, userId)))
          .limit(1)
          .then((r) => r[0] ?? null),
        db
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
          .limit(1)
          .then((r) => r[0] ?? null),
      ]);

      const briefing = valRow?.economy_briefing as {
        keyWarnings?: string[];
        keyOpportunities?: string[];
        briefingNarrative?: string;
      } | null;
      const resolution = valRow?.archetype_resolution as { primaryArchetype?: { name?: string } } | null;
      economyIntelligence = valRow ? {
        archetypeName: resolution?.primaryArchetype?.name ?? null,
        realityScore: valRow.reality_score ?? null,
        warning: briefing?.keyWarnings?.[0] ?? null,
        opportunity: briefing?.keyOpportunities?.[0] ?? null,
        reportHref: `/validation/${valRow.id}`,
      } : null;

      const briefingNarrative =
        briefing?.briefingNarrative?.trim() ||
        bpIntelRow?.economy_briefing_summary?.trim() ||
        null;
      const economyBriefingSummary = briefingNarrative
        ? briefingNarrative
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 2)
            .join(" ")
        : null;

      const archetypeName = bpIntelRow?.archetype_name ?? resolution?.primaryArchetype?.name ?? null;
      const realityScore = bpIntelRow?.reality_score ?? valRow?.reality_score ?? null;
      if (bpIntelRow?.primary_archetype_id && realityScore != null) {
        executionContext = {
          archetypeName,
          realityScore,
          blueprintTier: bpIntelRow.blueprint_tier ?? null,
          industryState: bpIntelRow.industry_state ?? null,
          economyBriefingSummary,
        };
      }

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

    let intelligence: {
      headline: string;
      bodyText: string | null;
      nextActionSuggestion: string | null;
      fallbackUsed: boolean;
    } = {
      headline: "Execution active.",
      bodyText: null,
      nextActionSuggestion: null,
      fallbackUsed: true,
    };

    if (blueprintId && activeBlueprint) {
      intelligence = await fetchDashboardIntelligence({
        userId,
        blueprintId,
        stateVersion,
        condition: condEffective.condition,
        completionRate: signalProjection?.completionRate ?? signals.consistency,
        momentum: signalProjection?.momentum ?? signals.streak,
        trend: signalProjection?.trend ?? "stable",
        goal: activeBlueprint.rawGoal ?? activeBlueprint.title ?? "",
        activeOrderTitle: primaryTask?.title,
        conditionDuration: condEffective.durationDays,
      });
    }

    const identityRow =
      blueprintId != null
        ? await getCurrentIdentityState(userId, blueprintId)
        : null;
    const identity = toDashboardIdentity(identityRow);

    let latestReward: Awaited<ReturnType<typeof getLatestRewardForBlueprint>> = null;
    let outcomeIntegrity: {
      openFlags: Awaited<ReturnType<typeof getOpenFlags>>;
      canAdvancePhase: boolean;
      blockers: string[];
    } = { openFlags: [], canAdvancePhase: true, blockers: [] };
    let phaseReadiness: {
      canAdvance: boolean;
      completionPercentage: number;
      blockers: string[];
      currentPhase: string;
      currentPhaseDaysActive: number;
    } | null = null;
    let academyTasksSummary: {
      pending: typeof academyTasks.$inferSelect[];
      blocksExecution: boolean;
    } = { pending: [], blocksExecution: false };
    let frameworks: {
      active: Array<{
        name: string;
        signalState: string;
        activationLevel: string;
        lastDecision: string | null;
      }>;
      hasEnforcedDecision: boolean;
    } = { active: [], hasEnforcedDecision: false };

    if (blueprintId) {
      latestReward = await getLatestRewardForBlueprint(userId, blueprintId);
      const integrity = await checkOutcomeIntegrity(userId, blueprintId);
      const openFlags = await getOpenFlags(blueprintId);
      outcomeIntegrity = {
        openFlags,
        canAdvancePhase: integrity.canAdvance,
        blockers: integrity.blockers,
      };

      const pendingAcademy = await db
        .select()
        .from(academyTasks)
        .where(
          and(
            eq(academyTasks.blueprint_id, blueprintId),
            eq(academyTasks.user_id, userId),
            inArray(academyTasks.status, ["pending", "in_progress"]),
          ),
        )
        .limit(10);
      academyTasksSummary = {
        pending: pendingAcademy,
        blocksExecution: pendingAcademy.some((t) => t.blocks_execution),
      };

      const [bpPhaseRow] = await db
        .select({ current_phase_id: blueprints.current_phase_id })
        .from(blueprints)
        .where(eq(blueprints.id, blueprintId))
        .limit(1);
      const currentPhaseId = bpPhaseRow?.current_phase_id ?? null;

      if (currentPhaseId) {
        const [phaseRow] = await db
          .select({ name: phases.name, started_at: phases.started_at, created_at: phases.created_at })
          .from(phases)
          .where(eq(phases.id, currentPhaseId))
          .limit(1);
        const readiness = await evaluatePhaseReadiness(blueprintId, currentPhaseId);
        const started = phaseRow?.started_at ?? phaseRow?.created_at ?? new Date();
        phaseReadiness = {
          ...readiness,
          currentPhase: phaseRow?.name ?? "Active",
          currentPhaseDaysActive: Math.floor((Date.now() - started.getTime()) / 86400000),
        };
      }

      const activations = await db
        .select()
        .from(frameworkActivations)
        .where(eq(frameworkActivations.blueprint_id, blueprintId))
        .orderBy(desc(frameworkActivations.created_at))
        .limit(8);

      const decisions = await db
        .select()
        .from(frameworkDecisions)
        .where(
          and(
            eq(frameworkDecisions.blueprint_id, blueprintId),
            inArray(frameworkDecisions.status, ["proposed", "approved"]),
          ),
        )
        .limit(5);

      frameworks = {
        active: activations.map((a) => ({
          name: a.framework_name,
          signalState: a.trigger_condition ?? "active",
          activationLevel: a.activation_level ?? "unknown",
          lastDecision:
            decisions.find((d) => d.activation_id === a.id)?.decision_type ?? null,
        })),
        hasEnforcedDecision: decisions.some(
          (d) => String(d.decision_type).toUpperCase() === "ENFORCE",
        ),
      };
    }

    const starterLabel =
      user?.tier === "starter" && condEffective?.condition
        ? mapStarterSignalLabel(condEffective.condition)
        : null;

    let prediction: Awaited<ReturnType<typeof PredictiveIntelligenceService.getLatestForBlueprint>> =
      null;
    let externalIntelligenceFreshness: "fresh" | "stale" | "none" = "none";
    if (blueprintId) {
      prediction = await PredictiveIntelligenceService.getLatestForBlueprint(blueprintId);
      const ext = await ExternalIntelligenceService.getLatestForBlueprint(blueprintId);
      externalIntelligenceFreshness = ext ? "fresh" : "none";
    }

    const predictionPayload = prediction
      ? {
          dropoutRisk: prediction.dropoutRisk,
          burnoutRisk: prediction.burnoutRisk,
          plateauRisk: prediction.plateauRisk,
          scalingReadiness: prediction.scalingReadiness,
          recommendedAction: prediction.recommendedAction,
          primaryRisk: prediction.primaryRisk,
          primaryOpportunity: prediction.primaryOpportunity,
          confidence:
            prediction.confidence === "LOW"
              ? 0.35
              : prediction.confidence === "MEDIUM"
                ? 0.65
                : prediction.confidence === "HIGH"
                  ? 0.9
                  : null,
        }
      : null;

    let homePanels: Awaited<ReturnType<typeof buildHomeDashboardPanels>> | null = null;
    if (blueprintId && activeBlueprint) {
      try {
        homePanels = await buildHomeDashboardPanels({
          userId,
          blueprintId,
          blueprintHref: `/blueprint/${blueprintId}`,
          dashboardUiState,
          conditionDetail: condEffective,
          signalProjection,
          signals,
          activeOrders,
          operationalAwareness,
          signalBlueprintBridge,
          intelligence,
          prediction: predictionPayload,
          phaseReadiness: phaseReadiness
            ? {
                completionPercentage: phaseReadiness.completionPercentage,
                currentPhase: phaseReadiness.currentPhase,
              }
            : null,
          recentFeedback,
          alerts: alerts.map((a) => ({ code: a.code, message: a.message, severity: a.severity })),
        });
      } catch (err) {
        logger.error({ err, blueprintId, userId }, "buildHomeDashboardPanels failed");
        homePanels = null;
      }
    }

    return {
      hasActiveBlueprint: Boolean(activeBlueprint),
      state: activeBlueprint ? ("ACTIVE_BLUEPRINT" as const) : ("NO_ACTIVE_BLUEPRINT" as const),
      user,
      identity: {
        ...identity,
        lastEvaluatedAt: identityRow?.updated_at ?? identityRow?.last_evidence_at ?? null,
      },
      latestReward,
      outcomeIntegrity,
      phaseReadiness,
      academyTasks: academyTasksSummary,
      frameworks,
      simplifiedSignalLabel: starterLabel,
      signals,
      activeBlueprint: activeBlueprint
        ? { ...activeBlueprint, economyIntelligence, executionContext }
        : activeBlueprint,
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
      intelligence,
      prediction: predictionPayload,
      externalIntelligenceFreshness,
      homePanels,
    };
  },
};
