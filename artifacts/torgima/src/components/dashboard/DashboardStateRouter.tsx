import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";
import { apiGet, startOrder } from "@/lib/torgima-api";
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
import { MorningReport } from "@/components/bhudhi/MorningReport";
import { StrategicOutlookPanel, type StrategicOutlookVm } from "@/components/bhudhi/StrategicOutlookPanel";
import { BehavioralInsightCard, type BehavioralInsightVm } from "@/components/bhudhi/BehavioralInsightCard";
import { SignalTrendPanel, type SignalNarrativeVm } from "@/components/bhudhi/SignalTrendPanel";
import { BlueprintHealthPanel, type BlueprintHealthVm } from "@/components/bhudhi/BlueprintHealthPanel";
import { GovernanceActionCenter, type GovernanceProposalVm } from "@/components/bhudhi/GovernanceActionCenter";
import { SkillProgressPanel } from "@/components/dashboard/SkillProgressPanel";
import { EconomyIntelligencePanel, type EconomyIntelligenceVm } from "@/components/dashboard/EconomyIntelligencePanel";
import { useExecutionStore } from "@/store/executionStore";

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
    const rawId = action?.orderId ?? action?.id;
    const orderId = typeof rawId === "string" ? rawId : undefined;
    if (!orderId) return;
    setStarting(true);
    try {
      await startOrder(orderId);
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
  const [, setLocation] = useLocation();
  const displayName =
    (state.user as { displayName?: string; email?: string })?.displayName ??
    (state.user as { email?: string })?.email?.split("@")[0] ??
    "Builder";
  const blueprint = state.activeBlueprint as { id?: string; title?: string } | null;
  const economyIntel = state.activeBlueprint as (typeof blueprint & {
    economyIntelligence?: EconomyIntelligenceVm;
    realityScore?: number;
    primaryArchetypeName?: string;
  });
  const morningReport = useExecutionStore((s) => s.morningReport);
  const refreshAll = useExecutionStore((s) => s.refreshAll);
  const [urgentOpportunity, setUrgentOpportunity] = useState<{
    description?: string;
    trend?: string;
    timeWindow?: string;
    urgency?: string;
  } | null>(null);
  const [dashboardIntel, setDashboardIntel] = useState<{
    strategicOutlook?: StrategicOutlookVm;
    behavioralInsight?: BehavioralInsightVm | null;
    blueprintHealth?: BlueprintHealthVm;
    signalNarrative?: SignalNarrativeVm;
    governanceSummary?: { proposals?: GovernanceProposalVm[] };
  } | null>(null);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void apiGet<typeof dashboardIntel>("/api/state/dashboard-intelligence")
      .then((d) => setDashboardIntel(d ?? null))
      .catch(() => null);

    void apiGet<{ opportunityWindows?: Array<{ description?: string; trend?: string; timeWindow?: string; urgency?: string }> }>(
      "/api/intelligence/eis",
    )
      .then((d) => {
        const urgent = d?.opportunityWindows?.find((o) => o.urgency === "HIGH") ?? null;
        setUrgentOpportunity(urgent);
      })
      .catch(() => null);
  }, []);

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

      {urgentOpportunity ? (
        <section className="rounded-2xl border border-green-200 bg-green-50 p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Opportunity window</p>
            <p className="text-sm font-semibold text-green-950 mt-1">
              {urgentOpportunity.description ?? urgentOpportunity.trend}
            </p>
            <p className="text-xs text-green-700 mt-1">{urgentOpportunity.timeWindow ?? "Act soon"}</p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/intelligence")}
            className="shrink-0 text-xs font-semibold text-green-900 bg-white border border-green-200 rounded-lg px-3 py-2 hover:bg-green-100"
          >
            View in Intelligence Report
          </button>
        </section>
      ) : null}

      <CurrentActionPanel
        uiState={uiState}
        action={state.currentAction as Record<string, unknown> | undefined}
        onStart={onStart}
        starting={starting}
      />

      <EconomyIntelligencePanel
        intelligence={
          economyIntel?.economyIntelligence ?? (
            economyIntel?.primaryArchetypeName || economyIntel?.realityScore != null
              ? {
                  archetypeName: economyIntel.primaryArchetypeName,
                  realityScore: economyIntel.realityScore,
                  reportHref: economyIntel.id ? `/validation/${economyIntel.id}` : undefined,
                }
              : null
          )
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <StrategicOutlookPanel outlook={dashboardIntel?.strategicOutlook} />
        <BehavioralInsightCard insight={dashboardIntel?.behavioralInsight} />
        <SignalTrendPanel signals={dashboardIntel?.signalNarrative} />
        <BlueprintHealthPanel health={dashboardIntel?.blueprintHealth} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Intelligence Report</p>
        <MorningReport report={morningReport} />
      </section>

      <GovernanceActionCenter
        proposals={dashboardIntel?.governanceSummary?.proposals}
        onChanged={() => {
          void apiGet<typeof dashboardIntel>("/api/state/dashboard-intelligence")
            .then((d) => setDashboardIntel(d ?? null))
            .catch(() => null);
        }}
      />

      <SkillProgressPanel />

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
