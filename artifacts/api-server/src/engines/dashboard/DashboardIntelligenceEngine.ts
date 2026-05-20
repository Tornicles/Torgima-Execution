import {
  db,
  blueprints,
  dashboardIntelligenceSnapshots,
  behavioralInsightRecords,
  blueprintHealthRecords,
  governanceQueue,
  signalSnapshots,
  conditions,
  burnoutRecords,
} from "@workspace/db";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { routeBhudhiRequest } from "../../bhudhi/TriggerRouter.js";
import { getWorldModel } from "../world-model/WorldModelEngine.js";
import { getActivePatterns } from "../pattern/PatternLearningEngine.js";
import { generateStrategicOutlook, type StrategicOutlook } from "./StrategicOutlookEngine.js";

export type DashboardRefreshTrigger = "SESSION_START" | "PRIMARY_LOOP_COMPLETE" | "OVERNIGHT_COMPLETE";

export interface BehavioralInsight {
  insightType: "STRENGTH" | "PATTERN" | "WARNING" | "OPPORTUNITY" | "MILESTONE";
  insightText: string;
  evidenceSummary: string;
  actionSuggestion?: string;
  triggerEvent: string;
}

export interface SignalNarrative {
  narrativeText: string;
  keyTrend: string;
  momentumStatus: string;
  sparkline: number[];
}

export interface DashboardIntelligenceSnapshot {
  strategicOutlook: StrategicOutlook;
  behavioralInsight: BehavioralInsight | null;
  blueprintHealth: Record<string, unknown>;
  signalNarrative: SignalNarrative;
  executionBrief: Record<string, unknown>;
  governanceSummary: Record<string, unknown>;
  lastRefreshed: string;
  snapshotVersion: number;
  worldStateVersion: number;
}

function ageHours(date: Date): number {
  return (Date.now() - date.getTime()) / (60 * 60 * 1000);
}

export function buildSignalNarrativeFromSnapshots(
  snapshots: Array<{ momentum: number; trend?: string | null; completion_rate?: number }>,
): SignalNarrative {
  const latest = snapshots[0];
  const trend = latest?.trend ?? "stable";
  const direction = trend === "improving" || trend === "rising" ? "Rising" : trend === "declining" ? "Declining" : "Stable";
  return {
    narrativeText:
      direction === "Declining"
        ? "Momentum trajectory is under pressure. Signal movement shows the next execution cycle should be protected and narrow."
        : direction === "Rising"
          ? "Momentum trajectory is rising. Signal movement supports a focused execution window."
          : "Momentum trajectory is stable. Signal movement points to maintaining execution continuity.",
    keyTrend: `Execution signal: ${direction}`,
    momentumStatus: `${direction} based on recent completion and momentum movement.`,
    sparkline: snapshots.slice(0, 14).reverse().map((s) => s.momentum),
  };
}

export function buildBehavioralInsight(params: {
  conditionChanged?: boolean;
  currentCondition?: string | null;
  patternCount?: number;
  burnoutRisk?: string | null;
  triggerEvent: string;
}): BehavioralInsight {
  if (params.conditionChanged) {
    return {
      insightType: "MILESTONE",
      insightText: "Execution pattern detected: condition transition completed without bypassing control rules.",
      evidenceSummary: `Condition movement into ${params.currentCondition ?? "current state"} triggered this insight.`,
      actionSuggestion: "Keep the next order evidence-based to stabilize the signal.",
      triggerEvent: params.triggerEvent,
    };
  }
  if (params.burnoutRisk === "HIGH") {
    return {
      insightType: "WARNING",
      insightText: "Execution pattern detected: recovery pressure is rising.",
      evidenceSummary: "Burnout signal is elevated in the latest record.",
      actionSuggestion: "Use a smaller order scope and protect completion quality.",
      triggerEvent: params.triggerEvent,
    };
  }
  return {
    insightType: params.patternCount ? "PATTERN" : "OPPORTUNITY",
    insightText: "Execution opportunity: one clean completion cycle can strengthen the current signal.",
    evidenceSummary: `${params.patternCount ?? 0} active pattern records informed this insight.`,
    actionSuggestion: "Complete the active order with clear proof.",
    triggerEvent: params.triggerEvent,
  };
}

export async function generateBehavioralInsightRecord(
  userId: string,
  triggerEvent: string,
): Promise<BehavioralInsight> {
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  const [currentCondition] = bp
    ? await db
        .select()
        .from(conditions)
        .where(and(eq(conditions.blueprint_id, bp.id), eq(conditions.is_current, true)))
        .orderBy(desc(conditions.created_at))
        .limit(1)
        .catch(() => [])
    : [];
  const patterns = bp ? await getActivePatterns(userId, bp.id).catch(() => []) : [];
  const [burnout] = await db
    .select()
    .from(burnoutRecords)
    .where(eq(burnoutRecords.user_id, userId))
    .orderBy(desc(burnoutRecords.created_at))
    .limit(1)
    .catch(() => []);

  let insight = buildBehavioralInsight({
    conditionChanged: triggerEvent === "CONDITION_CHANGED",
    currentCondition: currentCondition?.condition ?? bp?.current_condition,
    patternCount: patterns.length,
    burnoutRisk: burnout?.risk_level,
    triggerEvent,
  });

  try {
    const result = await routeBhudhiRequest({
      sourceEngine: "DashboardIntelligenceEngine",
      triggerType: "BEHAVIORAL_INSIGHT",
      userId,
      blueprintId: bp?.id,
      stateVersion: bp?.state_version ?? 0,
      idempotencyKey: `behavioral_insight:${userId}:${triggerEvent}:${Date.now()}`,
      facts: {
        behavioralProfile: {},
        activePatterns: patterns,
        currentCondition: currentCondition?.condition ?? bp?.current_condition,
        completionTrend: [],
        burnoutScore: burnout?.risk_score ?? 0,
      },
    });
    if (result.ok && result.output?.data) {
      insight = { ...insight, ...(result.output.data as Partial<BehavioralInsight>), triggerEvent };
    }
  } catch {
    // Deterministic insight remains valid.
  }

  await db.insert(behavioralInsightRecords).values({
    user_id: userId,
    insight_type: insight.insightType,
    insight_text: insight.insightText,
    evidence_summary: insight.evidenceSummary,
    action_suggestion: insight.actionSuggestion ?? null,
    trigger_event: triggerEvent,
  }).catch(() => null);

  return insight;
}

async function buildBlueprintHealth(userId: string, blueprintId?: string) {
  if (!blueprintId) return { healthScore: 0.5, status: "Blueprint health: forming", governanceSummary: { pendingCount: 0 } };
  const [health] = await db
    .select()
    .from(blueprintHealthRecords)
    .where(eq(blueprintHealthRecords.blueprint_id, blueprintId))
    .orderBy(desc(blueprintHealthRecords.created_at))
    .limit(1)
    .catch(() => []);
  const pending = await db
    .select()
    .from(governanceQueue)
    .where(and(eq(governanceQueue.blueprint_id, blueprintId), eq(governanceQueue.status, "PENDING")))
    .orderBy(desc(governanceQueue.priority), desc(governanceQueue.created_at))
    .catch(() => []);
  return {
    healthScore: health?.health_score ?? 0.65,
    status: (health?.health_score ?? 0.65) >= 0.75 ? "Blueprint health: Strong" : "Blueprint health: Watch",
    agentAssessment: health?.agent_assessment ?? "Execution continuity active.",
    governanceSummary: { pendingCount: pending.length, highestPriority: pending[0]?.priority ?? null, proposals: pending },
  };
}

async function buildSnapshot(userId: string, trigger: DashboardRefreshTrigger): Promise<DashboardIntelligenceSnapshot> {
  const world = await getWorldModel(userId);
  const [bp] = await db
    .select()
    .from(blueprints)
    .where(and(eq(blueprints.user_id, userId), eq(blueprints.active, true)))
    .limit(1);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const signals = bp
    ? await db
        .select()
        .from(signalSnapshots)
        .where(and(eq(signalSnapshots.user_id, userId), eq(signalSnapshots.blueprint_id, bp.id), gte(signalSnapshots.created_at, since)))
        .orderBy(desc(signalSnapshots.created_at))
        .catch(() => [])
    : [];

  const strategicOutlook = await generateStrategicOutlook(userId);
  const [unseen] = await db
    .select()
    .from(behavioralInsightRecords)
    .where(and(eq(behavioralInsightRecords.user_id, userId), eq(behavioralInsightRecords.seen, false), eq(behavioralInsightRecords.dismissed, false)))
    .orderBy(desc(behavioralInsightRecords.created_at))
    .limit(1)
    .catch(() => []);
  const behavioralInsight =
    unseen
      ? {
          insightType: unseen.insight_type as BehavioralInsight["insightType"],
          insightText: unseen.insight_text,
          evidenceSummary: unseen.evidence_summary,
          actionSuggestion: unseen.action_suggestion ?? undefined,
          triggerEvent: unseen.trigger_event,
        }
      : await generateBehavioralInsightRecord(userId, trigger === "PRIMARY_LOOP_COMPLETE" ? "PRIMARY_LOOP_COMPLETE" : "SESSION_START");
  const blueprintHealth = await buildBlueprintHealth(userId, bp?.id);
  const signalNarrative = buildSignalNarrativeFromSnapshots(signals);
  const executionBrief = {
    condition: bp?.current_condition ?? "stability",
    summary: strategicOutlook.highestLeverageAction,
    confidenceTier: strategicOutlook.confidenceTier,
  };
  const governanceSummary = (blueprintHealth.governanceSummary as Record<string, unknown>) ?? { pendingCount: 0 };

  return {
    strategicOutlook,
    behavioralInsight,
    blueprintHealth,
    signalNarrative,
    executionBrief,
    governanceSummary,
    lastRefreshed: new Date().toISOString(),
    snapshotVersion: 1,
    worldStateVersion: world?.stateVersion ?? bp?.state_version ?? 0,
  };
}

export async function refreshDashboardIntelligence(
  userId: string,
  trigger: DashboardRefreshTrigger,
): Promise<DashboardIntelligenceSnapshot> {
  const world = await getWorldModel(userId);
  const worldStateVersion = world?.stateVersion ?? 0;
  const [existing] = await db
    .select()
    .from(dashboardIntelligenceSnapshots)
    .where(eq(dashboardIntelligenceSnapshots.user_id, userId))
    .limit(1);

  if (
    trigger === "SESSION_START" &&
    existing &&
    existing.world_state_version === worldStateVersion &&
    ageHours(existing.last_refreshed) < 4
  ) {
    return {
      strategicOutlook: existing.strategic_outlook as StrategicOutlook,
      behavioralInsight: existing.behavioral_insight as BehavioralInsight | null,
      blueprintHealth: (existing.blueprint_health as Record<string, unknown>) ?? {},
      signalNarrative: existing.signal_narrative as SignalNarrative,
      executionBrief: (existing.execution_brief as Record<string, unknown>) ?? {},
      governanceSummary: (existing.governance_summary as Record<string, unknown>) ?? {},
      lastRefreshed: existing.last_refreshed.toISOString(),
      snapshotVersion: existing.snapshot_version,
      worldStateVersion: existing.world_state_version,
    };
  }

  if (trigger === "OVERNIGHT_COMPLETE") {
    await db
      .update(behavioralInsightRecords)
      .set({ dismissed: true })
      .where(and(eq(behavioralInsightRecords.user_id, userId), eq(behavioralInsightRecords.dismissed, true), lt(behavioralInsightRecords.created_at, new Date(Date.now() - 7 * 86400000))))
      .catch(() => null);
  }

  const snapshot = await buildSnapshot(userId, trigger);
  const nextVersion = (existing?.snapshot_version ?? 0) + 1;
  await db
    .insert(dashboardIntelligenceSnapshots)
    .values({
      user_id: userId,
      strategic_outlook: snapshot.strategicOutlook,
      behavioral_insight: snapshot.behavioralInsight,
      blueprint_health: snapshot.blueprintHealth,
      signal_narrative: snapshot.signalNarrative,
      execution_brief: snapshot.executionBrief,
      governance_summary: snapshot.governanceSummary,
      snapshot_version: nextVersion,
      world_state_version: snapshot.worldStateVersion,
      last_refreshed: new Date(),
    })
    .onConflictDoUpdate({
      target: dashboardIntelligenceSnapshots.user_id,
      set: {
        strategic_outlook: snapshot.strategicOutlook,
        behavioral_insight: snapshot.behavioralInsight,
        blueprint_health: snapshot.blueprintHealth,
        signal_narrative: snapshot.signalNarrative,
        execution_brief: snapshot.executionBrief,
        governance_summary: snapshot.governanceSummary,
        snapshot_version: nextVersion,
        world_state_version: snapshot.worldStateVersion,
        last_refreshed: new Date(),
      },
    });

  return { ...snapshot, snapshotVersion: nextVersion };
}
