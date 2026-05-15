import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/api-base";
import { ConditionalScreen } from "@/components/dashboard/ConditionalScreens";
import { CurrentActionPanel } from "@/components/dashboard/CurrentActionPanel";
import {
  AlertsPanel,
  ConditionPanel,
  IdentityRewardStrip,
  ProgressOverviewPanel,
  SignalSummaryPanel,
} from "@/components/dashboard/DashboardPanels";
import { ExecutionLoopTimeline } from "@/components/execution/ExecutionLoopTimeline";
import { OperationalAwarenessStrip } from "@/components/operational/OperationalAwarenessStrip";
import { getDashboardUiState, type DashboardProjection, type DashboardUiState } from "@/lib/dashboard-types";

export function DashboardStateRouter({
  state,
  isError,
  isFetching,
  refetch,
}: {
  state: DashboardProjection;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const uiState = getDashboardUiState(state);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (uiState === "NO_BLUEPRINT") {
      setLocation("/onboarding");
    }
  }, [uiState, setLocation]);

  if (uiState === "NO_BLUEPRINT") {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Redirecting to onboarding…
      </div>
    );
  }

  if (isError) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-4">
        <p className="text-red-800 font-medium">Could not load your execution state.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-sm font-semibold text-red-900 underline"
        >
          Try again
        </button>
      </section>
    );
  }

  const overlay = <ConditionalScreen state={state} />;
  if (overlay) return overlay;

  async function handleStart() {
    const action = state.currentAction;
    const orderId = action?.orderId ?? action?.id;
    if (!orderId || !API_BASE_URL) return;
    setStarting(true);
    try {
      await fetch(`${API_BASE_URL}/api/orders/${orderId}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
    } finally {
      setStarting(false);
    }
  }

  return (
    <DashboardMainContent
      state={state}
      uiState={uiState}
      isFetching={isFetching}
      onStart={() => void handleStart()}
      starting={starting}
    />
  );
}

function DashboardMainContent({
  state,
  uiState,
  isFetching,
  onStart,
  starting,
}: {
  state: DashboardProjection;
  uiState: DashboardUiState;
  isFetching: boolean;
  onStart: () => void;
  starting: boolean;
}) {
  const displayName =
    (state.user as { displayName?: string; email?: string })?.displayName ??
    (state.user as { email?: string })?.email?.split("@")[0] ??
    "Builder";
  const blueprint = state.activeBlueprint as { id?: string; title?: string } | null;

  return (
    <div className="space-y-6">
      {isFetching && (
        <p className="text-[10px] text-gray-400 uppercase tracking-wide text-right">Syncing…</p>
      )}

      <header>
        <h1 className="text-2xl font-bold text-gray-900">Command centre</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {displayName}.</p>
      </header>

      <AlertsPanel alerts={state.alerts as Parameters<typeof AlertsPanel>[0]["alerts"]} />

      <CurrentActionPanel
        uiState={uiState}
        action={state.currentAction as Record<string, unknown> | undefined}
        onStart={onStart}
        starting={starting}
      />

      <OperationalAwarenessStrip
        awareness={state.operationalAwareness as string[] | undefined}
        signalBridge={state.signalBlueprintBridge as Array<{ headline?: string; cite?: string }> | undefined}
        executionIdentity={state.executionIdentityLines as string[] | undefined}
      />

      {blueprint?.id && <ExecutionLoopTimeline blueprintId={blueprint.id} />}

      <div className="grid lg:grid-cols-2 gap-4 xl:hidden">
        <ConditionPanel state={state} />
        <SignalSummaryPanel state={state} />
      </div>

      <ProgressOverviewPanel state={state} />
      <IdentityRewardStrip state={state} />
    </div>
  );
}
