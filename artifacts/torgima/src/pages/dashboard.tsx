import { useEffect } from "react";
import { useLocation } from "wouter";
import { ConditionalScreen } from "@/components/dashboard/ConditionalScreens";
import { DashboardControlPanel } from "@/components/dashboard/DashboardControlPanel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { HealthLockState } from "@/components/dashboard/HealthLockState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LimitedModeDashboard } from "@/components/dashboard/LimitedModeDashboard";
import {
  isLimitedDashboardPayload,
  normalizeLimitedDashboardPayload,
} from "@/components/dashboard/LimitedDashboard/limited-dashboard-types";
import { MainDashboardView } from "@/components/dashboard/MainDashboardView";
import { PendingSyncState } from "@/components/dashboard/PendingSyncState";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { resolveDashboardShellState, toDashboardControlProjection } from "@/lib/dashboard-control";
import { getDashboardUiState, toDashboardProjection } from "@/lib/dashboard-types";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data, isLoading, isError, refetch, projection, pendingSync, invalidate } =
    useDashboardProjection();
  const limitedPayload = normalizeLimitedDashboardPayload(data);
  const { checking } = useAppRouteGuard(limitedPayload || (isLoading && !data) ? "pre-launch" : "post-launch");
  const { loaded } = useSessionGuard();
  const state = limitedPayload ? null : projection ?? (data ? toDashboardProjection(data) : null);
  const uiState = getDashboardUiState(state);
  const shellState = resolveDashboardShellState({
    loading: checking || !loaded || (isLoading && !data),
    projection: state,
  });
  const control = state ? toDashboardControlProjection(state) : null;

  useEffect(() => {
    if (limitedPayload) return;
    if (shellState === "PENDING_SYNC") {
      const t = setInterval(() => void refetch(), 5_000);
      return () => clearInterval(t);
    }
    return undefined;
  }, [shellState, refetch, limitedPayload]);

  useEffect(() => {
    if (limitedPayload) return;
    if (shellState === "NO_BLUEPRINT") {
      setLocation("/onboarding");
    }
  }, [shellState, setLocation, limitedPayload]);

  const handleRefresh = () => {
    invalidate();
    void refetch();
  };

  if (shellState === "LOADING" && !limitedPayload) {
    return <DashboardSkeleton />;
  }

  if (isLoading && !data && !limitedPayload) {
    return <DashboardSkeleton />;
  }

  if (limitedPayload) {
    return <LimitedModeDashboard {...limitedPayload} />;
  }

  if (isError && !data) {
    return <ErrorState onRetry={handleRefresh} />;
  }

  if (shellState === "NO_BLUEPRINT") {
    return null;
  }

  if (!state || !control) {
    return <DashboardSkeleton />;
  }

  if (shellState === "LOCKED" || control.locked) {
    return <HealthLockState reason={control.lockReason} onRefresh={handleRefresh} />;
  }

  const overlay = <ConditionalScreen state={state} />;
  if (overlay) return overlay;

  if (
    shellState === "PENDING_SYNC" ||
    (pendingSync && !control.currentAction && (state.launchFirstLoad?.totalOrders ?? 0) === 0)
  ) {
    return <PendingSyncState />;
  }

  return (
    <DashboardShell condition={control.condition}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <DashboardControlPanel state={state} uiState={uiState} onRefresh={handleRefresh} />
      </div>
      <MainDashboardView state={state} />
    </DashboardShell>
  );
}
