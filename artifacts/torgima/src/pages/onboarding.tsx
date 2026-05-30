import { useRef } from "react";
import { useLocation } from "wouter";
import { ErectorOnboardingRefinementFlow } from "@/components/onboarding/ErectorOnboardingRefinementFlow";

/**
 * Canonical onboarding path (steps 1–4 refinement + validation run).
 * Legacy steps 6–7 removed — results live at /validation/:id/results.
 */
export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  return (
    <ErectorOnboardingRefinementFlow
      idempotencyKey={idempotencyKeyRef.current}
      tier="starter"
      mode="individual"
      onValidationStarted={(validationId) => {
        sessionStorage.setItem("torgima_validation_results", validationId);
        setLocation(`/validation/${validationId}/results`);
      }}
    />
  );
}
