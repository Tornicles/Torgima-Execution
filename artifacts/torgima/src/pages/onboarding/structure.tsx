import { useEffect } from "react";
import { useLocation } from "wouter";
import { OnboardingStructureScreen } from "@/components/onboarding/OnboardingStructureScreen";
import { useOnboardingActiveBlueprintGuard } from "@/hooks/useOnboardingActiveBlueprintGuard";
import { useOnboardingRouteGuard } from "@/hooks/useOnboardingRouteGuard";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingStructurePage() {
  const [, setLocation] = useLocation();
  useOnboardingActiveBlueprintGuard();
  useOnboardingRouteGuard(3);

  const draft = useOnboardingFlowStore((s) => s.draft);
  const clarificationIndex = useOnboardingFlowStore((s) => s.clarificationIndex);
  const clarificationAnswers = useOnboardingFlowStore((s) => s.clarificationAnswers);
  const patchDraft = useOnboardingFlowStore((s) => s.patchDraft);
  const setStructuredGoal = useOnboardingFlowStore((s) => s.setStructuredGoal);
  const setWizardStatus = useOnboardingFlowStore((s) => s.setWizardStatus);
  const setClarificationIndex = useOnboardingFlowStore((s) => s.setClarificationIndex);
  const setClarificationAnswer = useOnboardingFlowStore((s) => s.setClarificationAnswer);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    setWizardStatus("STRUCTURING");
  }, [hydrate, setWizardStatus]);

  return (
    <OnboardingStructureScreen
      draft={draft}
      clarificationIndex={clarificationIndex}
      clarificationAnswers={clarificationAnswers}
      onDraftChange={patchDraft}
      onClarificationIndexChange={setClarificationIndex}
      onClarificationAnswer={setClarificationAnswer}
      onStructured={(structured) => {
        setStructuredGoal(structured);
        setWizardStatus("VALID_DRAFT");
        setLocation("/onboarding/review");
      }}
      onBack={() => setLocation("/onboarding/context")}
    />
  );
}
