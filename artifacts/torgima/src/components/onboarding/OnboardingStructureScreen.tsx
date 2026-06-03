import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { structureGoal } from "@/api/onboarding";
import {
  applyStructuredDraftToPreValidation,
  buildStructureGoalBody,
  parseStructuredGoalPayload,
  type StructuredGoalDraft,
} from "@/lib/onboarding-doc32";
import { LANGUAGE } from "@/lib/language";
import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { OnboardingClarificationStep } from "./OnboardingClarificationStep";

type Phase = "structuring" | "clarify" | "invalid" | "manual";

export function OnboardingStructureScreen({
  draft,
  clarificationIndex,
  clarificationAnswers,
  onDraftChange,
  onStructured,
  onClarificationIndexChange,
  onClarificationAnswer,
  onBack,
}: {
  draft: PreValidationDraft;
  clarificationIndex: number;
  clarificationAnswers: Record<string, string>;
  onDraftChange: (patch: Partial<PreValidationDraft>) => void;
  onStructured: (structured: StructuredGoalDraft) => void;
  onClarificationIndexChange: (index: number) => void;
  onClarificationAnswer: (field: string, value: string) => void;
  onBack: () => void;
}) {
  const idempotencyRef = useRef(`structure-${crypto.randomUUID()}`);
  const [phase, setPhase] = useState<Phase>("structuring");
  const [structured, setStructured] = useState<StructuredGoalDraft | null>(null);
  const [error, setError] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const ranRef = useRef(false);

  const runStructure = useCallback(async () => {
    setPhase("structuring");
    setError("");
    const res = await structureGoal(buildStructureGoalBody(draft, idempotencyRef.current));
    if (!res.ok) {
      setPhase("manual");
      setStructured(null);
      return;
    }
    const parsed = parseStructuredGoalPayload(res.data);
    if (!parsed) {
      setPhase("manual");
      return;
    }
    setStructured(parsed);
    if (parsed.validationVerdict === "INVALID") {
      setPhase("invalid");
      return;
    }
    if (parsed.missingRequiredFields.length > 0) {
      setPhase("clarify");
      onClarificationIndexChange(0);
      return;
    }
    const merged = applyStructuredDraftToPreValidation(draft, parsed);
    onDraftChange(merged);
    onStructured(parsed);
  }, [draft, onClarificationIndexChange, onDraftChange, onStructured]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void runStructure();
  }, [runStructure]);

  async function submitClarificationAnswer() {
    if (!structured) return;
    const field = structured.missingRequiredFields[clarificationIndex];
    if (!field) return;
    const answer = (clarificationAnswers[field] ?? "").trim();
    if (answer.length < 3) {
      setError(LANGUAGE.onboarding.clarificationTooShort);
      return;
    }
    setError("");
    setResubmitting(true);
    const patch: Partial<PreValidationDraft> = {};
    if (field === "goal") patch.goal = answer;
    else if (field === "purpose") patch.purpose = answer;
    else if (field === "timeframe") patch.timeframeDays = Number.parseInt(answer, 10) || draft.timeframeDays;
    else if (field === "commitment" || field === "commitmentLevel") patch.commitment = answer.toUpperCase();
    else patch.currentContext = answer;
    const nextDraft = { ...draft, ...patch };
    onDraftChange(patch);
    onClarificationAnswer(field, answer);

    const res = await structureGoal(
      buildStructureGoalBody(nextDraft, `clarify-${field}-${Date.now()}`),
    );
    setResubmitting(false);
    if (!res.ok) {
      onDraftChange(patch);
      if (clarificationIndex + 1 >= structured.missingRequiredFields.length) {
        onStructured({ ...structured, missingRequiredFields: [] });
      } else {
        onClarificationIndexChange(clarificationIndex + 1);
      }
      return;
    }
    const parsed = parseStructuredGoalPayload(res.data);
    if (!parsed) {
      onStructured(structured);
      return;
    }
    setStructured(parsed);
    if (parsed.missingRequiredFields.length === 0 || parsed.validationVerdict === "VALID") {
      const merged = applyStructuredDraftToPreValidation(nextDraft, parsed);
      onDraftChange(merged);
      onStructured(parsed);
      return;
    }
    if (clarificationIndex + 1 >= parsed.missingRequiredFields.length) {
      const merged = applyStructuredDraftToPreValidation(nextDraft, parsed);
      onDraftChange(merged);
      onStructured(parsed);
    } else {
      onClarificationIndexChange(clarificationIndex + 1);
    }
  }

  function skipToManualContinue() {
    onStructured(
      structured ?? {
        cleanedGoal: draft.goal,
        purpose: draft.purpose,
        timeframe: String(draft.timeframeDays),
        commitmentLevel: draft.commitment,
        currentContext: draft.currentContext,
        successSignals: [],
        blockers: [],
        domainHints: [],
        missingRequiredFields: [],
        ambiguityFlags: [],
        validationVerdict: "VALID",
      },
    );
  }

  if (phase === "structuring") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#5B21FF]" />
        <p className="text-sm font-semibold text-[#0B1220]">{LANGUAGE.onboarding.structuringLabel}</p>
        <p className="text-xs text-[#64748B]">{LANGUAGE.onboarding.structuringHint}</p>
      </div>
    );
  }

  if (phase === "clarify" && structured) {
    const field = structured.missingRequiredFields[clarificationIndex] ?? "goal";
    return (
      <>
        {error ? <p className="mx-auto max-w-xl px-6 text-sm text-red-600">{error}</p> : null}
        <OnboardingClarificationStep
          fieldKey={field}
          question={structured.suggestedClarifyingQuestion ?? undefined}
          answer={clarificationAnswers[field] ?? ""}
          onAnswerChange={(v) => onClarificationAnswer(field, v)}
          onSubmit={() => void submitClarificationAnswer()}
          submitting={resubmitting}
          onBack={clarificationIndex > 0 ? onBack : undefined}
        />
      </>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-6 py-12">
        <h2 className="text-xl font-bold text-[#0B1220]">{LANGUAGE.onboarding.invalidGoalTitle}</h2>
        <p className="text-sm text-[#64748B]">{LANGUAGE.onboarding.invalidGoalHint}</p>
        <button type="button" onClick={onBack} className="text-sm font-semibold text-[#5B21FF]">
          {LANGUAGE.onboarding.editGoalButton}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-6 py-12 text-center">
      <p className="text-sm text-[#64748B]">{LANGUAGE.onboarding.bhudhiFallbackHint}</p>
      <button
        type="button"
        onClick={skipToManualContinue}
        className="rounded-xl bg-[#5B21FF] px-6 py-3 text-sm font-bold text-white"
      >
        {LANGUAGE.onboarding.continueButton}
      </button>
      <button type="button" onClick={onBack} className="block mx-auto text-sm text-[#64748B] underline">
        {LANGUAGE.actions.back}
      </button>
    </div>
  );
}
