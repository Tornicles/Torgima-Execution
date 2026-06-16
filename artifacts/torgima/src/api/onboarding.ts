import { apiRequest } from "./client";
import type { ApiResponse } from "./types";

export function fetchOnboardingStatus(): Promise<
  ApiResponse<{
    completed?: boolean;
    onboardingComplete?: boolean;
    hasActiveBlueprint?: boolean;
    hasIntake?: boolean;
    intakeInProgress?: boolean;
    intakeSessionId?: string | null;
    intakeCurrentSection?: number | null;
    intakeSectionsCompleted?: number[];
    step?: string;
    onboardingStep?: string;
    blueprintId?: string | null;
    activeBlueprintId?: string | null;
  }>
> {
  return apiRequest("/api/onboarding/status");
}

export function configureOnboardingTier(body: {
  blueprintId: string;
  tier: "starter" | "growth" | "ultimate";
  mode?: "individual" | "team";
}): Promise<ApiResponse<{ configured?: boolean }>> {
  return apiRequest("/api/onboarding/configure-tier", { method: "POST", body });
}

export function submitOnboardingGoal(
  body: Record<string, unknown>,
): Promise<ApiResponse<{ blueprintId?: string }>> {
  return apiRequest("/api/onboarding/goal", { method: "POST", body });
}

export function structureGoal(
  body: Record<string, unknown>,
): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/bhudhi/structure-goal", { method: "POST", body });
}

export function selectBlueprintLaunch(
  body: Record<string, unknown>,
): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest("/api/onboarding/select-blueprint", { method: "POST", body });
}

export function activateBlueprint(
  blueprintId: string,
  body: Record<string, unknown> = {},
): Promise<ApiResponse<Record<string, unknown>>> {
  return apiRequest(`/api/blueprints/${blueprintId}/activate`, { method: "POST", body });
}
