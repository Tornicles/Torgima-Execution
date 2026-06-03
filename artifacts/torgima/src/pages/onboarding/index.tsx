import { useEffect } from "react";
import { useLocation } from "wouter";
import { OnboardingWelcomeStep } from "@/components/onboarding/OnboardingWelcomeStep";
import { GoalPurposeInputScreen } from "@/components/pre-validation/GoalPurposeInputScreen";
import { useOnboardingActiveBlueprintGuard } from "@/hooks/useOnboardingActiveBlueprintGuard";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingGoalPage() {
  const [, setLocation] = useLocation();
  useOnboardingActiveBlueprintGuard();

  const welcomeSeen = useOnboardingFlowStore((s) => s.welcomeSeen);
  const draft = useOnboardingFlowStore((s) => s.draft);
  const patchDraft = useOnboardingFlowStore((s) => s.patchDraft);
  const saveDraftToStorage = useOnboardingFlowStore((s) => s.saveDraftToStorage);
  const setWelcomeSeen = useOnboardingFlowStore((s) => s.setWelcomeSeen);
  const setWizardStatus = useOnboardingFlowStore((s) => s.setWizardStatus);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!welcomeSeen) {
    return (
      <OnboardingWelcomeStep
        onBegin={() => {
          setWelcomeSeen(true);
          setWizardStatus("DRAFTING");
        }}
      />
    );
  }

  return (
    <GoalPurposeInputScreen
      draft={draft}
      onDraftChange={patchDraft}
      onSaveDraft={saveDraftToStorage}
      onContinue={() => setLocation("/onboarding/context")}
    />
  );
}
