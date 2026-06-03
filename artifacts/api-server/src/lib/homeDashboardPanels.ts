/**
 * Aggregates real blueprint / signal / order data into home dashboard panel payloads.
 */
import { db, orders, phases, plans, projects, targets } from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { OrderStatus } from "@workspace/state-machine";
import { CONDITION_RULES, type Condition } from "../constants/conditions.js";
import { getOperationalRulesForCondition } from "../constants/conditionOperationalRules.js";
import type { DashboardUiState } from "../services/DashboardUiState.js";

const ACTION_DISPLAY: Record<string, string> = {
  recovery: "Stabilization",
  clarification: "Correction",
  simplification: "Correction",
  blocker_resolution: "Consistency",
  check_in: "Consistency",
  execution: "Execution",
  phase_checkpoint: "Review",
  habit: "Habit",
  review: "Review",
  academy: "Academy",
  phase_advance: "Expansion",
  new_scope: "Expansion",
  growth_tasks: "Scaling",
  scale_tasks: "Aggressive Growth",
  difficult_tasks: "High Difficulty",
};

function displayAction(key: string): string {
  return ACTION_DISPLAY[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityLabel(priority: number): "Critical" | "High" | "Medium" | "Low" {
  if (priority >= 9) return "Critical";
  if (priority >= 7) return "High";
  if (priority >= 5) return "Medium";
  return "Low";
}

function riskFromOrder(status: string, priority: number): "critical" | "high" | "medium" | "low" {
  if (status === OrderStatus.BLOCKED) return "critical";
  if (priority >= 9) return "high";
  if (priority >= 7) return "medium";
  return "low";
}

function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function executionModeLabel(
  uiState: DashboardUiState,
  condition: string,
  recoveryRequired: boolean,
  scalingReadiness: number | null | undefined,
): { mode: string; modeKey: string; accent: "orange" | "green" | "purple" | "red" | "blue" } {
  const c = condition.toLowerCase();
  if (uiState === "RECOVERY" || recoveryRequired || c === "danger") {
    return { mode: "Recovery Mode", modeKey: "recovery", accent: "orange" };
  }
  if (c === "urgency") return { mode: "Urgency Mode", modeKey: "urgency", accent: "orange" };
  if (c === "nothingness") return { mode: "Stability Mode", modeKey: "stability", accent: "purple" };
  if (c === "stability") return { mode: "Stability Mode", modeKey: "stability", accent: "green" };
  if (c === "power") return { mode: "Power Mode", modeKey: "power", accent: "purple" };
  if (c === "affluence") return { mode: "Affluence Mode", modeKey: "affluence", accent: "green" };
  if (c === "power_change") return { mode: "Power Change Mode", modeKey: "power_change", accent: "blue" };
  if (scalingReadiness != null && scalingReadiness >= 0.65) {
    return { mode: "Growth Mode", modeKey: "growth", accent: "green" };
  }
  return { mode: "Stability Mode", modeKey: "stability", accent: "green" };
}

export interface HomeDashboardPanels {
  blueprintTier?: string | null;
  signalMode?: string | null;
  executionHealth: {
    mode: string;
    modeKey: string;
    accent: string;
    condition: string;
    signalName: string | null;
    daysInState: number;
    driftDays: number | null;
    driftLabel: string | null;
    summary: string;
    reasoning: string[];
    blueprintHref: string;
  };
  today: {
    executing: number;
    queued: number;
    atRisk: number;
    capacityMinutes: number;
    capacityLabel: string;
    loadPercent: number;
    conditionImpact: string | null;
    ordersHref: string;
  };
  condition: {
    condition: string;
    conditionLabel: string;
    conditionExplanation?: string | null;
    urgency: boolean;
    allowed: string[];
    restricted: string[];
    confidencePercent: number;
  };
  topDrivers: Array<{
    name: string;
    direction: "up" | "down";
    impactPercent: number;
    driverType: string;
  }>;
  todayOrders: Array<{
    rank: number;
    id: string;
    title: string;
    projectName: string | null;
    orderType: string;
    estimatedMinutes: number | null;
    priority: string;
    risk: string;
    status: string;
    whyItMatters: string | null;
  }>;
  todayOrdersTotal: number;
  timelineIntegrity: {
    plannedPercent: number;
    actualPercent: number;
    driftDays: number | null;
    driftLabel: string | null;
    ahead: boolean;
    riskLevel: string | null;
  };
  milestones: Array<{
    id: string;
    name: string;
    expectedDate: string | null;
    predictedDate: string | null;
    varianceDays: number | null;
    status: string;
  }>;
  planOverview: {
    currentPlanIndex: number;
    totalPlans: number;
    completionPercent: number;
    plans: Array<{ index: number; name: string; status: string }>;
    href: string;
  };
  phaseProgress: {
    currentPhaseIndex: number;
    totalPhases: number;
    phases: Array<{ index: number; name: string; status: string; label: string | null }>;
    href: string;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    at: string;
    href: string | null;
  }>;
  bhudhiInsight: {
    headline: string;
    body: string | null;
    nextAction: string | null;
  } | null;
}

export async function buildHomeDashboardPanels(params: {
  userId: string;
  blueprintId: string;
  blueprintHref: string;
  dashboardUiState: DashboardUiState;
  blueprintTier?: string | null;
  signalMode?: string | null;
  signalDisplayName?: string | null;
  conditionExplanation?: string | null;
  conditionDetail: {
    condition: string;
    durationDays: number;
    recoveryRequired: boolean;
    transitionReason?: string | null;
  };
  signalProjection: {
    completionRate: number;
    momentum: number;
    confidence: string | null;
    blockerRatio: number | null;
    skipRatio: number | null;
  } | null;
  signals: { condition: string; velocity?: number; consistency?: number };
  activeOrders: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    priority?: number;
    estimatedMinutes?: number | null;
  }>;
  operationalAwareness: string[];
  signalBlueprintBridge: Array<{ headline: string; cite: string }>;
  intelligence: {
    headline: string;
    bodyText: string | null;
    nextActionSuggestion: string | null;
  };
  prediction: {
    primaryRisk: string | null;
    primaryOpportunity: string | null;
    confidence: number | null;
    scalingReadiness: number | null;
    dropoutRisk?: number | null;
    burnoutRisk?: number | null;
  } | null;
  phaseReadiness: {
    completionPercentage: number;
    currentPhase: string;
  } | null;
  recentFeedback: Array<{ id: string; createdAt: string | Date; orderId?: string | null }>;
  alerts: Array<{ code: string; message: string; severity: string }>;
}): Promise<HomeDashboardPanels> {
  const condition = params.conditionDetail.condition.toLowerCase();
  const rules = getOperationalRulesForCondition(condition);
  const condRules = CONDITION_RULES[condition as Condition];

  const [planRows, phaseRows, enrichedOrders] = await Promise.all([
    db
      .select({
        id: plans.id,
        name: plans.name,
        title: plans.title,
        status: plans.status,
        order_index: plans.order_index,
      })
      .from(plans)
      .where(eq(plans.blueprint_id, params.blueprintId))
      .orderBy(asc(plans.order_index)),

    db
      .select({
        id: phases.id,
        name: phases.name,
        title: phases.title,
        status: phases.status,
        order_index: phases.order_index,
        progress_percent: phases.progress_percent,
        is_active: phases.is_active,
        locked: phases.locked,
        started_at: phases.started_at,
        completed_at: phases.completed_at,
        target_id: phases.target_id,
      })
      .from(phases)
      .where(eq(phases.blueprint_id, params.blueprintId))
      .orderBy(asc(phases.order_index)),

    db
      .select({
        id: orders.id,
        title: orders.title,
        status: orders.status,
        priority: orders.priority,
        task_type: orders.task_type,
        order_type: orders.order_type,
        time_estimate_minutes: orders.time_estimate_minutes,
        why_it_matters: orders.why_it_matters,
        project_id: orders.project_id,
        phase_id: orders.phase_id,
        project_name: projects.name,
        project_title: projects.title,
        phase_name: phases.name,
        phase_title: phases.title,
      })
      .from(orders)
      .leftJoin(projects, eq(orders.project_id, projects.id))
      .leftJoin(phases, eq(orders.phase_id, phases.id))
      .where(
        and(
          eq(orders.blueprint_id, params.blueprintId),
          eq(orders.user_id, params.userId),
          inArray(orders.status, [
            OrderStatus.PENDING,
            OrderStatus.ACTIVE,
            OrderStatus.BLOCKED,
            OrderStatus.NEEDS_FEEDBACK,
            OrderStatus.NEEDS_PROOF,
          ]),
        ),
      )
      .orderBy(desc(orders.priority), desc(orders.created_at)),
  ]);

  const executing = enrichedOrders.filter((o) => o.status === OrderStatus.ACTIVE).length;
  const queued = enrichedOrders.filter((o) => o.status === OrderStatus.PENDING).length;
  const atRisk = enrichedOrders.filter(
    (o) => o.status === OrderStatus.BLOCKED || o.priority >= 8,
  ).length;

  const capacityMinutes =
    condRules?.maxDailyTasks != null ? condRules.maxDailyTasks * 25 : 9 * 25;
  const scheduledMinutes = enrichedOrders.reduce(
    (sum, o) => sum + (o.time_estimate_minutes ?? 20),
    0,
  );
  const loadPercent = Math.min(
    100,
    Math.round((scheduledMinutes / Math.max(1, capacityMinutes)) * 100),
  );

  const plannedPercent = Math.round(params.phaseReadiness?.completionPercentage ?? 0);
  const rawActual = params.signalProjection?.completionRate ?? params.signals.consistency ?? 0;
  const actualPercent = Math.round(rawActual <= 1 ? rawActual * 100 : rawActual);
  const momentum = params.signalProjection?.momentum ?? 0;
  const driftDays =
    plannedPercent > actualPercent
      ? Math.max(1, Math.round(((plannedPercent - actualPercent) / 100) * 30 + Math.abs(momentum) * 3))
      : null;

  const mode = executionModeLabel(
    params.dashboardUiState,
    condition,
    params.conditionDetail.recoveryRequired,
    params.prediction?.scalingReadiness ?? null,
  );

  const reasoning = [
    ...params.operationalAwareness.slice(0, 2),
    ...(params.signalBlueprintBridge.slice(0, 2).map((l) => l.headline)),
  ].filter(Boolean);

  const summary =
    params.intelligence.bodyText?.trim() ||
    rules?.transitionMessage ||
    params.operationalAwareness[0] ||
    params.intelligence.headline;

  const allowed = (rules?.allowedActions ?? condRules?.allowedTypes ?? []).map(displayAction);
  const restricted = (rules?.restrictedActions ?? []).map(displayAction);

  let confidencePercent = 50;
  const conf = params.signalProjection?.confidence?.toLowerCase();
  if (conf === "high") confidencePercent = 92;
  else if (conf === "medium") confidencePercent = 75;
  else if (conf === "low") confidencePercent = 55;
  if (params.prediction?.confidence != null) {
    const pc =
      params.prediction.confidence <= 1
        ? Math.round(params.prediction.confidence * 100)
        : Math.round(params.prediction.confidence);
    confidencePercent = Math.round((confidencePercent + pc) / 2);
  }
  confidencePercent = Math.min(100, Math.max(0, confidencePercent));

  const drivers: HomeDashboardPanels["topDrivers"] = [];
  const br = params.signalProjection?.blockerRatio;
  if (br != null && br > 0.05) {
    drivers.push({
      name: "Resource Availability",
      direction: "down",
      impactPercent: -Math.round(br * 100),
      driverType: "Primary Constraint",
    });
  }
  if (momentum !== 0) {
    drivers.push({
      name: "Execution Momentum",
      direction: momentum >= 0 ? "up" : "down",
      impactPercent: Math.round(momentum * 10) || (momentum >= 0 ? 7 : -5),
      driverType: "Secondary Driver",
    });
  }
  const sr = params.signalProjection?.skipRatio;
  if (sr != null && sr > 0.05) {
    drivers.push({
      name: "Focus Stability",
      direction: "down",
      impactPercent: -Math.round(sr * 100) || -3,
      driverType: "Behavior Driver",
    });
  }
  if (params.prediction?.primaryRisk) {
    drivers.push({
      name: params.prediction.primaryRisk,
      direction: "down",
      impactPercent: -Math.round((params.prediction.dropoutRisk ?? 0.15) * 100) || -10,
      driverType: "Execution Driver",
    });
  }
  if (params.prediction?.primaryOpportunity && drivers.length < 4) {
    drivers.push({
      name: params.prediction.primaryOpportunity,
      direction: "up",
      impactPercent: Math.round((params.prediction.scalingReadiness ?? 0.2) * 100) || 7,
      driverType: "Strategic Driver",
    });
  }
  for (const line of params.signalBlueprintBridge.slice(0, 2)) {
    if (drivers.length >= 3) break;
    if (line.headline.toLowerCase().includes("blocker")) {
      drivers.push({
        name: "Signal Volatility",
        direction: "down",
        impactPercent: -8,
        driverType: "Behavior Driver",
      });
    }
  }

  const todayOrders = enrichedOrders.slice(0, 8).map((o, i) => ({
    rank: i + 1,
    id: o.id,
    title: o.title,
    projectName: o.project_title ?? o.project_name ?? null,
    orderType: (o.order_type ?? o.task_type ?? "execution").replace(/_/g, " "),
    estimatedMinutes: o.time_estimate_minutes,
    priority: priorityLabel(o.priority),
    risk: riskFromOrder(o.status, o.priority),
    status: o.status,
    whyItMatters: o.why_it_matters,
  }));

  const targetIds = phaseRows.map((p) => p.target_id).filter(Boolean) as string[];
  const targetDue = new Map<string, Date>();
  if (targetIds.length > 0) {
    const tRows = await db
      .select({ id: targets.id, due_date: targets.due_date })
      .from(targets)
      .where(inArray(targets.id, targetIds));
    for (const t of tRows) {
      if (t.due_date) targetDue.set(t.id, t.due_date);
    }
  }

  const milestones = phaseRows.slice(0, 6).map((p) => {
    const due = p.target_id ? targetDue.get(p.target_id) : null;
    const progress = Number(p.progress_percent ?? 0);
    let status = "Upcoming";
    if (p.status === "complete" || progress >= 100) status = "Completed";
    else if (p.status === "active" || p.is_active) status = "On Track";
    else if (p.locked) status = "Locked";
    else if (progress > 0 && progress < 50 && driftDays) status = "Delayed";
    else if (driftDays && driftDays > 7) status = "Overdue";

    const varianceDays =
      driftDays && (status === "Delayed" || status === "Overdue") ? driftDays : null;

    return {
      id: p.id,
      name: p.title ?? String(p.name).replace(/_/g, " "),
      expectedDate: due ? due.toISOString().slice(0, 10) : null,
      predictedDate: null,
      varianceDays,
      status,
    };
  });

  const activePlanIdx = Math.max(0, planRows.findIndex((p) => p.status === "active"));
  const planCompletion = plannedPercent;

  const activePhaseIdx = Math.max(
    0,
    phaseRows.findIndex((p) => p.is_active || p.status === "active"),
  );

  const phaseLabels: Record<string, string> = {
    initiation: "Ignition",
    development: "Foundation",
    completion: "Completion",
    scale: "Scale",
    optimization: "Optimization",
  };

  const activity: HomeDashboardPanels["recentActivity"] = [];
  for (const f of params.recentFeedback.slice(0, 3)) {
    activity.push({
      id: `fb-${f.id}`,
      type: "feedback",
      message: "Feedback recorded on completed order",
      at: new Date(f.createdAt).toISOString(),
      href: f.orderId ? `/feedback/${f.orderId}` : "/feedback",
    });
  }
  for (const a of params.alerts.slice(0, 2)) {
    activity.push({
      id: `alert-${a.code}`,
      type: "signal",
      message: a.message,
      at: new Date().toISOString(),
      href: "/signals",
    });
  }
  for (const line of params.signalBlueprintBridge.slice(0, 2)) {
    activity.push({
      id: `bridge-${activity.length}`,
      type: "condition",
      message: line.headline,
      at: new Date().toISOString(),
      href: "/signals",
    });
  }
  if (params.intelligence.headline) {
    activity.push({
      id: "intel-headline",
      type: "bhudhi",
      message: params.intelligence.headline,
      at: new Date().toISOString(),
      href: "/app/bhudhi",
    });
  }

  const conditionImpact =
    loadPercent >= 85 && restricted.length > 0
      ? "Condition limiting order volume."
      : params.conditionDetail.recoveryRequired
        ? "Recovery mode reducing daily capacity."
        : null;

  const signalName =
    params.signalDisplayName ??
    (params.signalProjection ? "Current signal window" : null);

  return {
    blueprintTier: params.blueprintTier ?? null,
    signalMode: params.signalMode ?? null,
    executionHealth: {
      ...mode,
      condition,
      signalName,
      daysInState: params.conditionDetail.durationDays,
      driftDays,
      driftLabel: driftDays != null ? `(-${driftDays} Day Drift)` : null,
      summary,
      reasoning,
      blueprintHref: params.blueprintHref,
    },
    today: {
      executing,
      queued,
      atRisk,
      capacityMinutes,
      capacityLabel: formatMinutes(capacityMinutes),
      loadPercent,
      conditionImpact,
      ordersHref: "/orders",
    },
    condition: {
      condition,
      conditionLabel: condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      conditionExplanation: params.conditionExplanation ?? null,
      urgency: condition === "urgency" || condition === "danger",
      allowed: [...new Set(allowed)],
      restricted: [...new Set(restricted)],
      confidencePercent,
    },
    topDrivers: drivers.slice(0, 3),
    todayOrders,
    todayOrdersTotal: enrichedOrders.length,
    timelineIntegrity: {
      plannedPercent,
      actualPercent,
      driftDays,
      driftLabel: driftDays != null ? `-${driftDays} Days` : null,
      ahead: actualPercent >= plannedPercent,
      riskLevel: driftDays && driftDays > 7 ? "high" : driftDays ? "medium" : null,
    },
    milestones,
    planOverview: {
      currentPlanIndex: activePlanIdx + 1,
      totalPlans: planRows.length || 1,
      completionPercent: planCompletion,
      plans: planRows.map((p, i) => ({
        index: i + 1,
        name: p.title ?? p.name,
        status:
          p.status === "complete"
            ? "Completed"
            : i === activePlanIdx
              ? "Active"
              : i < activePlanIdx
                ? "Completed"
                : "Locked",
      })),
      href: params.blueprintHref,
    },
    phaseProgress: {
      currentPhaseIndex: activePhaseIdx + 1,
      totalPhases: phaseRows.length || 1,
      phases: phaseRows.map((p, i) => {
        let status = "Locked";
        if (p.status === "complete") status = "Completed";
        else if (p.is_active || p.status === "active") status = "Current";
        else if (i < activePhaseIdx) status = "Completed";
        else if (!p.locked && i === activePhaseIdx + 1) status = "Upcoming";
        return {
          index: i + 1,
          name: p.title ?? String(p.name).replace(/_/g, " "),
          status,
          label:
            status === "Current"
              ? `${phaseLabels[String(p.name)] ?? "Phase"} Current`
              : status === "Completed"
                ? `${phaseLabels[String(p.name)] ?? "Phase"} Complete`
                : null,
        };
      }),
      href: params.blueprintHref,
    },
    recentActivity: activity.slice(0, 6),
    bhudhiInsight: {
      headline: params.intelligence.headline,
      body: params.intelligence.bodyText,
      nextAction: params.intelligence.nextActionSuggestion,
    },
  };
}
