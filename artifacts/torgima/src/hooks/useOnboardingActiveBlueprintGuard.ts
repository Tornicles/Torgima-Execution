import { useEffect } from "react";
import { useLocation } from "wouter";
import { fetchOnboardingStatus } from "@/api/onboarding";

/**
 * DOC 32 §1 — redirect users with an active execution system away from onboarding.
 */
export function useOnboardingActiveBlueprintGuard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    void fetchOnboardingStatus().then((res) => {
      if (res.ok && res.data?.hasActiveBlueprint) {
        setLocation("/dashboard");
      }
    });
  }, [setLocation]);
}
