import { useEffect } from "react";
import { useLocation } from "wouter";
import { GoalPurposeInputScreen } from "@/components/pre-validation/GoalPurposeInputScreen";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingGoalPage() {
  const [, setLocation] = useLocation();
  const draft = useOnboardingFlowStore((s) => s.draft);
  const patchDraft = useOnboardingFlowStore((s) => s.patchDraft);
  const saveDraftToStorage = useOnboardingFlowStore((s) => s.saveDraftToStorage);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <GoalPurposeInputScreen
      draft={draft}
      onDraftChange={patchDraft}
      onSaveDraft={saveDraftToStorage}
      onContinue={() => setLocation("/onboarding/context")}
    />
  );
}
