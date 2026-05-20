import { BlueprintStatus } from "@workspace/state-machine";
import { CompletionScreen } from "@/components/dashboard/CompletionScreen";
import { PausedOverlay } from "@/components/dashboard/PausedOverlay";
import { PivotReviewScreen } from "@/components/dashboard/PivotReviewScreen";

type DashboardState = Record<string, any>;

/** Full-viewport overlays driven by Prompt 15 dashboard projection precedence. */
export function ConditionalScreen({ state }: { state: DashboardState }) {
  const flags = state.featureFlags ?? {};

  const bp = state.activeBlueprint;
  const bpId = bp?.id ?? null;

  const pivotAllowed = flags.pivot_review_ui !== false;
  if (
    pivotAllowed &&
    state.pivotReviewOpen &&
    state.pivotReviewId &&
    bpId &&
    bp &&
    typeof state.pivotReview === "object" &&
    state.pivotReview
  ) {
    return <PivotReviewScreen blueprintId={bpId} reviewId={state.pivotReviewId} pivot={state.pivotReview} />;
  }

  if (bp?.status === BlueprintStatus.PAUSED) {
    return <PausedOverlay blueprintId={bp.id} blueprint={bp} />;
  }

  const completionId =
    bp?.status === BlueprintStatus.COMPLETE
      ? bp.id
      : state.recentCompletionBlueprint?.id && state.recentCompletionBlueprint.status === BlueprintStatus.COMPLETE
        ? state.recentCompletionBlueprint.id
        : null;

  if (completionId && flags.completion_celebration !== false) {
    return <CompletionScreen blueprintId={completionId} />;
  }

  return null;
}
