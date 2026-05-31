import { useEffect } from "react";
import { useLocation } from "wouter";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export type OnboardingStepRequirement = 1 | 2 | 3 | 4;

export function useOnboardingRouteGuard(required: OnboardingStepRequirement) {
  const [, setLocation] = useLocation();
  const draft = useOnboardingFlowStore((s) => s.draft);
  const validationId = useOnboardingFlowStore((s) => s.validationId);

  useEffect(() => {
    const hasGoal = draft.goal.trim().length >= 20;
    const hasPurpose = draft.purpose.trim().length >= 20;
    const hasContext =
      Boolean(draft.countryName.trim()) &&
      Boolean(draft.quickContext.domain.trim() || draft.currentStage.trim()) &&
      Boolean(draft.currentStage.trim()) &&
      Boolean(draft.startDate) &&
      Boolean(draft.endDate) &&
      Boolean(draft.weeklyCommitment);

    if (required >= 2 && (!hasGoal || !hasPurpose)) {
      setLocation("/onboarding");
      return;
    }
    if (required >= 3 && !hasContext) {
      setLocation("/onboarding/context");
      return;
    }
    if (required >= 4 && !validationId) {
      setLocation("/onboarding/review");
    }
  }, [required, draft, validationId, setLocation]);
}
