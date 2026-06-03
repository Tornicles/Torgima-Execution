import { Loader2 } from "lucide-react";
import { CLARIFICATION_FIELD_LABELS } from "@/lib/onboarding-doc32";
import { LANGUAGE } from "@/lib/language";

export function OnboardingClarificationStep({
  fieldKey,
  question,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  onBack,
}: {
  fieldKey: string;
  question?: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
  onBack?: () => void;
}) {
  const label =
    question?.trim() ||
    CLARIFICATION_FIELD_LABELS[fieldKey] ||
    LANGUAGE.onboarding.clarificationDefault;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#5B21FF]">
          {LANGUAGE.onboarding.clarificationKicker}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#0B1220]">{LANGUAGE.onboarding.clarificationTitle}</h2>
        <p className="mt-2 text-sm text-[#64748B]">{label}</p>
      </div>
      <textarea
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        rows={4}
        className="w-full rounded-2xl border border-[#E2E8F0] px-4 py-3 text-sm text-[#0B1220] shadow-sm focus:border-[#5B21FF] focus:outline-none focus:ring-2 focus:ring-[#5B21FF]/20"
        placeholder={LANGUAGE.onboarding.clarificationPlaceholder}
      />
      <div className="flex flex-wrap gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold text-[#64748B] disabled:opacity-50"
          >
            {LANGUAGE.actions.back}
          </button>
        ) : null}
        <button
          type="button"
          disabled={submitting || answer.trim().length < 3}
          onClick={onSubmit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5B21FF] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {LANGUAGE.states.processing}
            </>
          ) : (
            LANGUAGE.onboarding.continueButton
          )}
        </button>
      </div>
    </div>
  );
}
