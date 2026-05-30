import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { GoalPurposeInputScreen } from "@/components/pre-validation/GoalPurposeInputScreen";
import { ContextTimeframeInputScreen } from "@/components/pre-validation/ContextTimeframeInputScreen";
import { PreValidationReviewStep } from "@/components/pre-validation/PreValidationReviewStep";
import { PreValidationValidateStep } from "@/components/pre-validation/PreValidationValidateStep";
import {
  loadPreValidationDraft,
  savePreValidationDraft,
  seedErectorOnboardingFromDraft,
  type PreValidationDraft,
} from "@/lib/pre-validation-draft";
import { persistErectorOnboarding } from "@/lib/erector-onboarding-flow";
import type { ErectorContextForm } from "@/lib/onboarding-goal-payload";
import type { CommitmentKey } from "@/components/onboarding/erector-intake-types";

const ERECTOR_CONTEXT_KEY = "torgima_pre_validation_erector_context";

function persistErectorContextFromDraft(draft: PreValidationDraft) {
  const ctx: ErectorContextForm = {
    country: draft.countryName
      ? { countryName: draft.countryName, countryCode: draft.countryCode ?? "" }
      : null,
    domain: draft.quickContext.domain || "SaaS",
    commitment: (draft.weeklyCommitment as CommitmentKey) || "MEDIUM",
    currentContext: [
      draft.environmentDescription,
      draft.currentSituation && `Situation: ${draft.currentSituation}`,
      draft.currentStage && `Stage: ${draft.currentStage}`,
      draft.resourcesAvailable && `Resources: ${draft.resourcesAvailable}`,
      draft.quickContext.targetAudience && `Audience: ${draft.quickContext.targetAudience}`,
      draft.quickContext.primaryFocus && `Focus: ${draft.quickContext.primaryFocus}`,
      ...draft.environmentTags.map((t) => `Tag: ${t}`),
    ]
      .filter(Boolean)
      .join("\n"),
    timeframeDays: draft.timeframeDays,
    pace:
      draft.pacing === "LIGHT"
        ? "low"
        : draft.pacing === "AGGRESSIVE" || draft.pacing === "INTENSE"
          ? "high"
          : "moderate",
  };
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(ERECTOR_CONTEXT_KEY, JSON.stringify(ctx));
  }
}

export default function PreValidationPage() {
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState<PreValidationDraft>(() => loadPreValidationDraft());
  const [launching, setLaunching] = useState(false);

  const updateDraft = useCallback((patch: Partial<PreValidationDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      savePreValidationDraft(next);
      return next;
    });
  }, []);

  function saveDraft() {
    savePreValidationDraft(draft);
  }

  function goToRefinement() {
    setLaunching(true);
    seedErectorOnboardingFromDraft(draft);
    persistErectorContextFromDraft(draft);
    persistErectorOnboarding({
      step: "raw_goal",
      rawGoal: draft.goal.trim(),
      goalOptions: [],
      selectedGoal: "",
      rawPurpose: draft.purpose.trim(),
      purposeOptions: [],
      selectedPurpose: "",
    });
    setLocation("/onboarding");
  }

  if (draft.step === 1) {
    return (
      <GoalPurposeInputScreen
        draft={draft}
        onDraftChange={updateDraft}
        onSaveDraft={saveDraft}
        onContinue={() => updateDraft({ step: 2 })}
      />
    );
  }

  if (draft.step === 2) {
    return (
      <ContextTimeframeInputScreen
        draft={draft}
        onDraftChange={updateDraft}
        onBack={() => updateDraft({ step: 1 })}
        onContinue={() => updateDraft({ step: 3 })}
      />
    );
  }

  if (draft.step === 3) {
    return (
      <PreValidationReviewStep
        draft={draft}
        onBack={() => updateDraft({ step: 2 })}
        onContinue={() => updateDraft({ step: 4 })}
        onEditStep={(step) => updateDraft({ step })}
      />
    );
  }

  return (
    <PreValidationValidateStep
      draft={draft}
      onBack={() => updateDraft({ step: 3 })}
      onLaunch={goToRefinement}
      launching={launching}
    />
  );
}
