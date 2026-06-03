import { apiRequest } from "./client";
import type { ApiResponse } from "./types";

export function fetchIdentityCurrent(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/identity/current");
}

export function fetchIdentityHistory(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/identity/history");
}

export function fetchRewardsCurrent(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/rewards/current");
}

export function fetchRewardsHistory(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/rewards/history");
}

export function fetchOutcomesCurrent(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/outcomes/current");
}

export function fetchPatternsCurrent(): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/patterns/current");
}
