import { useState } from "react";
import type { DashboardUiState } from "@/lib/dashboard-types";
import { toDashboardControlProjection } from "@/lib/dashboard-control";
import type { DashboardProjection } from "@/lib/dashboard-types";
import { CurrentActionPanel } from "./CurrentActionPanel";
import { DependencyBanner } from "./DependencyBanner";
import { IdentityRewardPanel } from "./IdentityRewardPanel";
import { RecoveryBanner } from "./RecoveryBanner";
import { SystemStateStrip } from "./SystemStateStrip";

/** DOC 33 — primary control surface above locked home layout. */
export function DashboardControlPanel({
  state,
  uiState,
  onRefresh,
}: {
  state: DashboardProjection;
  uiState: DashboardUiState;
  onRefresh: () => void;
}) {
  const control = toDashboardControlProjection(state);
  const [starting, setStarting] = useState(false);
  const tier = (
    state.blueprintTier ??
    (state.activeBlueprint as { blueprintTier?: string } | undefined)?.blueprintTier ??
    "starter"
  ).toLowerCase();
  const showRawNumbers = tier === "ultimate";

  return (
    <div className="space-y-4 mb-6">
      {control.recoveryAlert ? <RecoveryBanner alert={control.recoveryAlert} /> : null}
      {control.dependencyAlert ? <DependencyBanner alert={control.dependencyAlert} /> : null}
      <CurrentActionPanel
        uiState={uiState}
        order={control.currentAction}
        stateVersion={control.stateVersion}
        onRefresh={onRefresh}
        onStart={() => {
          setStarting(true);
          setTimeout(() => setStarting(false), 800);
        }}
        starting={starting}
      />
      <SystemStateStrip
        conditionLabel={control.conditionLabel}
        signals={control.signalSummary}
        showRawNumbers={showRawNumbers}
      />
      <IdentityRewardPanel identity={control.identitySnapshot} reward={control.rewardSnapshot} compact />
    </div>
  );
}
