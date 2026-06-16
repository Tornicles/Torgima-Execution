import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DashboardUiState } from "@/lib/dashboard-types";
import type { DashboardProjection } from "@/lib/dashboard-types";
import { toDashboardControlProjection } from "@/lib/dashboard-control";
import {
  mutationsDisabledForState,
  resolveDashboardSystemState,
} from "@/lib/dashboard-states";
import { startOrder } from "@/api/orders";
import { invalidateDashboardProjection } from "@/lib/query-keys";
import { useStaleStateStore } from "@/lib/state-version";
import { CurrentActionPanel } from "./CurrentActionPanel";
import { DependencyPanel } from "./DependencyPanel";
import { ConditionPanel } from "./ConditionPanel";
import { FeedbackPendingState } from "./FeedbackPendingState";
import { IdentityRewardPanel } from "./IdentityRewardPanel";
import { OutcomeSummary } from "./OutcomeSummary";
import { RecoveryBanner } from "./RecoveryBanner";
import { RewardToast } from "./RewardToast";

/** DOC 33 — FULL mode control surface; two-column layout, projection-only data. */
export function DashboardControlPanel({
  state,
  uiState,
  onRefresh,
}: {
  state: DashboardProjection;
  uiState: DashboardUiState;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const control = toDashboardControlProjection(state);
  const [starting, setStarting] = useState(false);
  const staleActive = useStaleStateStore((s) => s.visible);
  const systemState = resolveDashboardSystemState({ uiState, control, staleActive });
  const mutationsDisabled = mutationsDisabledForState(systemState, starting);

  const handleStart = useCallback(async () => {
    const orderId = control.currentAction?.orderId;
    if (!orderId || mutationsDisabled) return;
    setStarting(true);
    try {
      const res = await startOrder(orderId, control.stateVersion);
      if (res.ok) {
        await invalidateDashboardProjection(queryClient);
        onRefresh();
      }
    } finally {
      setStarting(false);
    }
  }, [control.currentAction?.orderId, control.stateVersion, mutationsDisabled, onRefresh, queryClient]);

  const showFeedbackPending =
    systemState === "FEEDBACK_PENDING" && uiState !== "LOCKED";

  return (
    <div className="mb-6 grid max-w-full grid-cols-1 gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        {control.recoveryAlert ? <RecoveryBanner alert={control.recoveryAlert} /> : null}
        {control.dependencyAlert ? <DependencyPanel alert={control.dependencyAlert} /> : null}
        {showFeedbackPending ? <FeedbackPendingState /> : null}
        <CurrentActionPanel
          uiState={uiState}
          order={control.currentAction}
          stateVersion={control.stateVersion}
          onRefresh={onRefresh}
          onStart={() => void handleStart()}
          starting={starting}
          mutationsDisabled={mutationsDisabled}
          recoveryMode={systemState === "RECOVERY_STATE"}
        />
      </div>

      <div className="min-w-0 space-y-4">
        <RewardToast reward={control.rewardSnapshot} />
        <ConditionPanel condition={control.conditionPanel} signals={control.signalSummary} />
        <IdentityRewardPanel
          identity={control.identitySnapshot}
          reward={control.rewardSnapshot}
          compact
        />
        <OutcomeSummary outcome={control.outcomeSummary} />
      </div>
    </div>
  );
}
