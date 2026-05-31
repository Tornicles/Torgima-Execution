import { useEffect } from "react";
import { useLocation } from "wouter";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

/** Redirect to canonical validation results route. */
export default function OnboardingResultsPage() {
  const [, setLocation] = useLocation();
  const validationId = useOnboardingFlowStore((s) => s.validationId);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    const id =
      validationId ??
      (typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("torgima_validation_results")
        : null);
    if (id) setLocation(`/validation/${id}/results`);
    else setLocation("/onboarding/review");
  }, [hydrate, validationId, setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#5B21FF] border-t-transparent" />
    </div>
  );
}
