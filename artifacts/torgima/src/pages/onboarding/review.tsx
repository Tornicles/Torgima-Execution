import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { PreValidationReviewStep } from "@/components/pre-validation/PreValidationReviewStep";
import { useOnboardingActiveBlueprintGuard } from "@/hooks/useOnboardingActiveBlueprintGuard";
import { useOnboardingRouteGuard } from "@/hooks/useOnboardingRouteGuard";
import { postOnboardingGoal, runOnboardingValidation } from "@/lib/onboarding-api";
import { useOnboardingFlowStore } from "@/store/onboardingFlowStore";

export default function OnboardingReviewPage() {
  const [, setLocation] = useLocation();
  useOnboardingActiveBlueprintGuard();
  useOnboardingRouteGuard(3);
  const draft = useOnboardingFlowStore((s) => s.draft);
  const structuredGoal = useOnboardingFlowStore((s) => s.structuredGoal);
  const submitError = useOnboardingFlowStore((s) => s.submitError);
  const patchDraft = useOnboardingFlowStore((s) => s.patchDraft);
  const setBlueprintId = useOnboardingFlowStore((s) => s.setBlueprintId);
  const setValidationId = useOnboardingFlowStore((s) => s.setValidationId);
  const setSubmitError = useOnboardingFlowStore((s) => s.setSubmitError);
  const clearSubmitError = useOnboardingFlowStore((s) => s.clearSubmitError);
  const hydrate = useOnboardingFlowStore((s) => s.hydrate);
  const idempotencyRef = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!structuredGoal) {
      setLocation("/onboarding/structure");
    }
  }, [structuredGoal, setLocation]);

  const startValidation = useCallback(async () => {
    clearSubmitError();
    setSubmitting(true);
    try {
      const goalRes = await postOnboardingGoal(draft, idempotencyRef.current);
      if (!goalRes.ok) {
        setSubmitError(goalRes.message);
        return;
      }
      setBlueprintId(goalRes.blueprintId);

      const runRes = await runOnboardingValidation(draft, goalRes.blueprintId);
      if (!runRes.ok) {
        setSubmitError(runRes.message);
        return;
      }
      setValidationId(runRes.validationId);
      setLocation("/onboarding/validating");
    } finally {
      setSubmitting(false);
    }
  }, [
    draft,
    clearSubmitError,
    setBlueprintId,
    setSubmitError,
    setValidationId,
    setLocation,
  ]);

  return (
    <>
      {submitError ? (
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-red-200 bg-red-50 px-6 py-4">
          <p className="mx-auto max-w-3xl text-sm text-red-800">{submitError}</p>
          <button
            type="button"
            onClick={() => void startValidation()}
            disabled={submitting}
            className="mx-auto mt-2 block rounded-lg bg-[#5B21FF] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Retrying…" : "Retry validation"}
          </button>
        </div>
      ) : null}
      <PreValidationReviewStep
        draft={draft}
        onBack={() => setLocation("/onboarding/context")}
        onContinue={() => void startValidation()}
        onEditStep={(step) => {
          if (step === 1) setLocation("/onboarding");
          else if (step === 2) setLocation("/onboarding/context");
          else setLocation("/onboarding/structure");
        }}
        continueDisabled={submitting}
        continueLabel={submitting ? "Starting validation…" : undefined}
      />
    </>
  );
}
