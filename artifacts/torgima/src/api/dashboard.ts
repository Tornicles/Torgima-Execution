import { apiRequest } from "./client";
import type { ApiResponse } from "./types";
import type { DashboardProjection } from "@/lib/dashboard-types";

export function fetchStateCurrent(): Promise<
  ApiResponse<{
    stateVersion: number;
    blueprintId: string | null;
    pendingSync: boolean;
  }>
> {
  return apiRequest("/api/state/current");
}

export function fetchDashboardProjection(): Promise<ApiResponse<DashboardProjection>> {
  return apiRequest<DashboardProjection>("/api/state/dashboard");
}
