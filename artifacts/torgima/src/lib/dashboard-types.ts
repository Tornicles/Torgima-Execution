export type DashboardUiState =
  | "NO_BLUEPRINT"
  | "READY"
  | "IN_PROGRESS"
  | "AWAITING_FEEDBACK"
  | "BLOCKED"
  | "RECOVERY"
  | "LOCKED"
  | "PENDING_SYNC"
  | "ERROR";

export interface DashboardAlert {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  actionHref?: string;
  actionLabel?: string;
}

import type { DashboardState } from "@workspace/api-client-react";

import type { HomeDashboardPanels } from "@/lib/home-dashboard-types";

export type LaunchFirstLoadProjection = {
  projectionId?: string;
  generatedAt?: string;
  freshness?: string;
  blueprint?: {
    id?: string;
    projectName?: string | null;
    goal?: string;
    purpose?: string;
    domain?: string;
    status?: string;
    currentCondition?: string;
  };
  activeCondition?: {
    condition?: string;
    label?: string;
    description?: string;
    severity?: string;
    allowedActions?: string[];
    restrictedActions?: string[];
    nextUnlockSignal?: string;
    taskLimitMin?: number;
    taskLimitMax?: number;
    difficultyCap?: string;
  };
  signals?: {
    completionRate?: number;
    weightedScore?: number;
    momentum?: number;
    trend?: string;
    confidence?: string;
    dataPoints?: number;
    label?: string;
    description?: string;
  };
  orders?: Array<{
    id: string;
    title: string;
    instruction: string;
    expectedOutput: string;
    definitionOfDone: string;
    whyItMatters?: string | null;
    difficulty?: string;
    timeEstimateMinutes?: number | null;
    priority?: number;
    priorityLabel?: string;
    status?: string;
    sequenceNumber?: number;
  }>;
  totalOrders?: number;
  identity?: { stage?: string; label?: string; description?: string };
  validationInsights?: {
    goal?: string;
    verdict?: string;
    realityScore?: number | null;
    selectedPath?: string;
  };
};

export type BlueprintPositionProjection = {
  tier: string;
  currentPlan: {
    id: string;
    name: string;
    planType: string | null;
    sequenceNumber: number;
    status: string;
  } | null;
  currentTarget: {
    id: string;
    name: string;
    metric: string | null;
    expectedValue: string | number | null;
    status: string;
  } | null;
  currentPhase: {
    id: string;
    name: string;
    phaseType: string | null;
    status: string;
  } | null;
  currentProject: {
    id: string;
    name: string;
    projectType: string | null;
    status: string;
  } | null;
  currentAction: {
    id: string;
    name: string;
    instruction: string | null;
    expectedOutput: string | null;
    actionType: string | null;
  } | null;
  progressSummary: {
    plansTotal: number;
    plansCompleted: number;
    phasesTotal: number;
    phasesCompleted: number;
    actionsTotal: number;
    actionsCompleted: number;
    percentComplete: number;
  };
};

export type DashboardProjection = DashboardState & {
  dashboardUiState?: DashboardUiState;
  pendingSync?: boolean;
  alerts?: DashboardAlert[];
  homePanels?: HomeDashboardPanels | null;
  launchFirstLoad?: LaunchFirstLoadProjection | null;
  blueprintPosition?: BlueprintPositionProjection | null;
};

export function toDashboardProjection(state: DashboardState): DashboardProjection {
  return state as DashboardProjection;
}

export function getDashboardUiState(state: DashboardProjection | null | undefined): DashboardUiState {
  if (!state) return "ERROR";
  if (state.dashboardUiState) return state.dashboardUiState as DashboardUiState;
  if (!state.activeBlueprint) return "NO_BLUEPRINT";
  if (state.health && state.health.systemOperational === false) return "LOCKED";
  return "READY";
}
