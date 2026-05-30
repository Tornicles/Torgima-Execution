/**
 * Bhudhi Hub dashboard payload — real blueprint / signal / order / feedback data only.
 */
import {
  db,
  bhudhiLogs,
  validations,
  orders,
  signalSnapshots,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";
import { getBhudhiStatus } from "../bhudhi/api/BhudhiCatalogService.js";
import {
  BHUDHI_CATEGORY_META,
  BHUDHI_POPULAR_QUESTIONS,
  BHUDHI_TOTAL_QUESTIONS,
  type BhudhiQuestionCategory,
} from "./bhudhiQuestionCatalog.js";
import type { DashboardService } from "../services/DashboardService.js";

function momentumLabel(momentum: number): string {
  if (momentum < -0.1) return "Weak";
  if (momentum < 0.25) return "Moderate";
  if (momentum < 0.55) return "Strong";
  return "Accelerating";
}

function focusLabel(condition: string, recoveryRequired: boolean): string {
  if (recoveryRequired || condition === "danger") return "Recover";
  if (condition === "urgency") return "Stabilize";
  if (condition === "power" || condition === "affluence") return "Scale";
  if (condition === "power_change") return "Protect";
  if (condition === "nothingness") return "Build";
  return "Execute";
}

function formatSyncAgo(date: Date | null): string {
  if (!date) return "—";
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h}h ago`;
}

type DashState = Awaited<ReturnType<typeof DashboardService.getDashboardState>>;

export interface BhudhiHubPanels {
  core: {
    active: boolean;
    online: boolean;
    allSystemsConnected: boolean;
    lastSyncAt: string | null;
    lastSyncLabel: string;
  };
  pipeline: Array<{ id: string; name: string; live: boolean; status: string }>;
  glance: {
    condition: string;
    conditionLabel: string;
    momentum: string;
    momentumRaw: number;
    focus: string;
    goalProgressPercent: number;
  };
  systemActivity: Array<{
    id: string;
    title: string;
    reason: string;
    at: string;
    source: string;
  }>;
  popularQuestions: Record<
    BhudhiQuestionCategory,
    { title: string; questionCount: number; questions: Array<{ key: string; label: string }> }
  >;
  recentQuestions: Array<{
    id: string;
    question: string;
    context: string | null;
    at: string;
  }>;
  totalQuestions: number;
  primaryOrderTitle: string | null;
}

export async function buildBhudhiHubPanels(params: {
  userId: string;
  blueprintId: string;
  dashboard: DashState;
}): Promise<BhudhiHubPanels> {
  const { userId, blueprintId, dashboard } = params;

  const condDetail = dashboard.conditionDetail as {
    condition?: string;
    durationDays?: number;
    recoveryRequired?: boolean;
    transitionReason?: string | null;
  } | null;
  const condition = (condDetail?.condition ?? dashboard.signals?.condition ?? "stability").toLowerCase();
  const recoveryRequired = Boolean(condDetail?.recoveryRequired);
  const sp = dashboard.signalProjection as {
    completionRate?: number;
    momentum?: number;
    trend?: string | null;
    confidence?: string | null;
  } | null;
  const momentum = sp?.momentum ?? dashboard.signals?.streak ?? 0;
  const phasePct = Math.round(
    (dashboard.phaseReadiness as { completionPercentage?: number } | null)?.completionPercentage ?? 0,
  );
  const [bhudhiStatus, validationRow, snapRow, logRows, primaryOrder] = await Promise.all([
    getBhudhiStatus(blueprintId),
    db
      .select({ id: validations.id, created_at: validations.created_at })
      .from(validations)
      .where(eq(validations.blueprint_id, blueprintId))
      .orderBy(desc(validations.created_at))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ created_at: signalSnapshots.created_at })
      .from(signalSnapshots)
      .where(
        and(eq(signalSnapshots.blueprint_id, blueprintId), eq(signalSnapshots.is_current, true)),
      )
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        id: bhudhiLogs.id,
        trigger_type: bhudhiLogs.trigger_type,
        request_type: bhudhiLogs.request_type,
        input_json: bhudhiLogs.input_json,
        created_at: bhudhiLogs.created_at,
        order_id: bhudhiLogs.order_id,
      })
      .from(bhudhiLogs)
      .where(and(eq(bhudhiLogs.user_id, userId), eq(bhudhiLogs.blueprint_id, blueprintId)))
      .orderBy(desc(bhudhiLogs.created_at))
      .limit(12),
    db
      .select({ title: orders.title })
      .from(orders)
      .where(
        and(
          eq(orders.blueprint_id, blueprintId),
          eq(orders.user_id, userId),
          inArray(orders.status, [OrderStatus.PENDING, OrderStatus.ACTIVE]),
        ),
      )
      .orderBy(desc(orders.priority))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const systemsActive = (bhudhiStatus.systems?.active ?? 0) > 0;
  const enginesActive = (bhudhiStatus.engines?.active ?? 0) > 0;
  const hasBlueprint = Boolean(dashboard.activeBlueprint);
  const hasSignal = Boolean(snapRow);
  const hasOrders = (dashboard.activeOrders?.length ?? 0) > 0;
  const hasFeedback = (dashboard.recentFeedback?.length ?? 0) > 0;
  const hasValidation = Boolean(validationRow);

  const pipeline = [
    {
      id: "erector",
      name: "Erector Validation",
      live: hasValidation,
      status: hasValidation ? "Live" : "Awaiting",
    },
    {
      id: "blueprint",
      name: "Blueprint Engine",
      live: hasBlueprint,
      status: hasBlueprint ? "Live" : "Inactive",
    },
    {
      id: "signals",
      name: "Signal Engine",
      live: hasSignal,
      status: hasSignal ? "Live" : "Syncing",
    },
    {
      id: "orders",
      name: "Orders System",
      live: hasOrders,
      status: hasOrders ? "Live" : "Idle",
    },
    {
      id: "feedback",
      name: "Feedback System",
      live: hasFeedback,
      status: hasFeedback ? "Live" : "Idle",
    },
  ];

  const allConnected = pipeline.every((p) => p.live);
  const lastSync = snapRow?.created_at ?? logRows[0]?.created_at ?? null;

  const activity: BhudhiHubPanels["systemActivity"] = [];
  const bridge = (dashboard.signalBlueprintBridge ?? []) as Array<{ headline: string; cite: string }>;
  for (const [i, line] of bridge.slice(0, 4).entries()) {
    activity.push({
      id: `bridge-${i}`,
      title: line.headline.slice(0, 120),
      reason: line.cite.slice(0, 200),
      at: new Date().toISOString(),
      source: "Signal Engine",
    });
  }
  for (const [i, msg] of (dashboard.operationalAwareness ?? []).slice(0, 3).entries()) {
    activity.push({
      id: `op-${i}`,
      title: msg.slice(0, 100),
      reason: "Operational awareness from condition and enforcement state.",
      at: new Date().toISOString(),
      source: "Blueprint Engine",
    });
  }
  for (const alert of (dashboard.alerts ?? []).slice(0, 2)) {
    activity.push({
      id: `alert-${alert.code}`,
      title: alert.message,
      reason: `Severity: ${alert.severity}`,
      at: new Date().toISOString(),
      source: "Control System",
    });
  }
  if (dashboard.intelligence?.headline) {
    activity.push({
      id: "intel",
      title: dashboard.intelligence.headline,
      reason: dashboard.intelligence.bodyText ?? "Bhudhi intelligence bridge",
      at: new Date().toISOString(),
      source: "Bhudhi",
    });
  }

  const recentQuestions = logRows.slice(0, 6).map((row) => {
    const input = row.input_json as Record<string, unknown> | null;
    const q =
      (typeof input?.question === "string" && input.question) ||
      (typeof input?.questionKey === "string" && input.questionKey.replace(/_/g, " ")) ||
      row.trigger_type?.replace(/_/g, " ") ||
      row.request_type?.replace(/_/g, " ") ||
      "System explanation";
    return {
      id: row.id,
      question: q,
      context: primaryOrder?.title ?? null,
      at: row.created_at.toISOString(),
    };
  });

  const popularQuestions = {} as BhudhiHubPanels["popularQuestions"];
  for (const cat of Object.keys(BHUDHI_CATEGORY_META) as BhudhiQuestionCategory[]) {
    const meta = BHUDHI_CATEGORY_META[cat];
    popularQuestions[cat] = {
      title: meta.title,
      questionCount: meta.questionCount,
      questions: BHUDHI_POPULAR_QUESTIONS.filter((q) => q.category === cat).map((q) => ({
        key: q.key,
        label: q.label,
      })),
    };
  }

  return {
    core: {
      active: systemsActive && enginesActive,
      online: systemsActive && enginesActive && hasBlueprint,
      allSystemsConnected: allConnected,
      lastSyncAt: lastSync?.toISOString() ?? null,
      lastSyncLabel: formatSyncAgo(lastSync),
    },
    pipeline,
    glance: {
      condition: condition,
      conditionLabel: condition.replace(/_/g, " ").toUpperCase(),
      momentum: momentumLabel(momentum),
      momentumRaw: momentum,
      focus: focusLabel(condition, recoveryRequired),
      goalProgressPercent: phasePct,
    },
    systemActivity: activity.slice(0, 8),
    popularQuestions,
    recentQuestions,
    totalQuestions: BHUDHI_TOTAL_QUESTIONS,
    primaryOrderTitle:
      (dashboard.currentAction as { title?: string } | null)?.title ??
      primaryOrder?.title ??
      null,
  };
}

export function dashboardToExplainContext(
  dashboard: DashState,
  allowed: string[],
  restricted: string[],
): import("./bhudhiHubExplain.js").BhudhiExplainContext {
  const condDetail = dashboard.conditionDetail as {
    condition?: string;
    durationDays?: number;
    transitionReason?: string | null;
    recoveryRequired?: boolean;
  } | null;
  const sp = dashboard.signalProjection as {
    completionRate?: number;
    momentum?: number;
    trend?: string | null;
    confidence?: string | null;
  } | null;
  const identity = dashboard.identity as {
    stage?: string | null;
    summary?: string | null;
    label?: string | null;
  } | null;
  const home = dashboard.homePanels as { today?: { atRisk?: number; queued?: number } } | null;

  return {
    condition: condDetail?.condition ?? dashboard.signals?.condition ?? "stability",
    conditionDurationDays: condDetail?.durationDays ?? 0,
    transitionReason: condDetail?.transitionReason ?? null,
    recoveryRequired: Boolean(condDetail?.recoveryRequired),
    completionRate: sp?.completionRate ?? dashboard.signals?.consistency ?? 0,
    momentum: sp?.momentum ?? 0,
    trend: sp?.trend ?? null,
    signalConfidence: sp?.confidence ?? null,
    goalProgressPercent: Math.round(
      (dashboard.phaseReadiness as { completionPercentage?: number } | null)?.completionPercentage ?? 0,
    ),
    currentTaskTitle:
      (dashboard.currentAction as { title?: string } | null)?.title ??
      (dashboard.homePanels as { todayOrders?: Array<{ title: string }> } | null)?.todayOrders?.[0]
        ?.title ??
      null,
    operationalLines: dashboard.operationalAwareness ?? [],
    bridgeLines: (dashboard.signalBlueprintBridge ?? []) as Array<{ headline: string; cite: string }>,
    intelligenceHeadline: dashboard.intelligence?.headline ?? null,
    intelligenceBody: dashboard.intelligence?.bodyText ?? null,
    identityStage: identity?.label ?? identity?.stage ?? null,
    identitySummary: identity?.summary ?? null,
    primaryRisk: (dashboard.prediction as { primaryRisk?: string } | null)?.primaryRisk ?? null,
    primaryOpportunity:
      (dashboard.prediction as { primaryOpportunity?: string } | null)?.primaryOpportunity ?? null,
    allowedActions: allowed,
    restrictedActions: restricted,
    atRiskOrderCount: home?.today?.atRisk ?? 0,
    queuedOrderCount: home?.today?.queued ?? 0,
  };
}
