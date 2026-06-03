/** Mirrors api-server `homeDashboardPanels` payload (GET /api/state/dashboard). */
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

export function getHomePanels(state: {
  homePanels?: HomeDashboardPanels | null;
}): HomeDashboardPanels | null {
  return state.homePanels ?? null;
}
