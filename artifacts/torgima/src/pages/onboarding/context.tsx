import { useEffect } from "react";
import { useLocation } from "wouter";
import { ContextTimeframeInputScreen } from "@/components/pre-validation/ContextTimeframeInputScreen";
import { useOnboardingRouteGuard } from "@/hooks/useOnboardingRouteGuard";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingContextPage() {
  const [, setLocation] = useLocation();
  useOnboardingRouteGuard(2);
  const draft = useOnboardingFlowStore((s) => s.draft);
  const patchDraft = useOnboardingFlowStore((s) => s.patchDraft);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ContextTimeframeInputScreen
      draft={draft}
      onDraftChange={patchDraft}
      onBack={() => setLocation("/onboarding")}
      onContinue={() => setLocation("/onboarding/review")}
    />
  );
}
