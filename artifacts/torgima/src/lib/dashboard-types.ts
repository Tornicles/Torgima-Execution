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

export type DashboardProjection = DashboardState & {
  dashboardUiState?: DashboardUiState;
  pendingSync?: boolean;
  alerts?: DashboardAlert[];
  homePanels?: HomeDashboardPanels | null;
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
