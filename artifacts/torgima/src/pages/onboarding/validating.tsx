import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { OnboardingValidatingScreen } from "@/components/onboarding/OnboardingValidatingScreen";
import { useOnboardingRouteGuard } from "@/hooks/useOnboardingRouteGuard";
import { fetchValidationStatus } from "@/lib/onboarding-api";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingValidatingPage() {
  const [, setLocation] = useLocation();
  useOnboardingRouteGuard(4);
  const draft = useOnboardingFlowStore((s) => s.draft);
  const validationId = useOnboardingFlowStore((s) => s.validationId);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    if (!validationId) setLocation("/onboarding/review");
  }, [hydrate, validationId, setLocation]);

  const pollStatus = useCallback(() => {
    if (!validationId) return Promise.resolve({ status: "running", progress: 0 });
    return fetchValidationStatus(validationId);
  }, [validationId]);

  const onComplete = useCallback(() => {
    if (validationId) {
      setLocation(`/validation/${validationId}/results`);
    } else {
      setLocation("/onboarding/results");
    }
  }, [validationId, setLocation]);

  if (!validationId) return null;

  return (
    <OnboardingValidatingScreen draft={draft} pollStatus={pollStatus} onComplete={onComplete} />
  );
}
