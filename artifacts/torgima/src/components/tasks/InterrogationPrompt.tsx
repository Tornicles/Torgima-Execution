import { useState } from "react";
import { Loader2 } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import { submitFeedbackClarification } from "@/api/orders";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardProjection } from "@/lib/query-keys";

const CLARIFY_MIN = 30;

/** DOC 34 — semi-transparent overlay when feedback needs clarification. */
export function InterrogationPrompt({
  feedbackId,
  question,
  onSuccess,
  onDismiss,
}: {
  feedbackId: string;
  question: string;
  onSuccess: () => void;
  onDismiss?: () => void;
}) {
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (submitting) return;
    if (detail.trim().length < CLARIFY_MIN) {
      setError(LANGUAGE.feedback.interrogation.minDetail);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await submitFeedbackClarification(feedbackId, detail.trim());
    if (res.ok) {
      await invalidateDashboardProjection(queryClient);
      onSuccess();
      return;
    }
    if (res.error?.code === "STALE_STATE") {
      setError(LANGUAGE.feedback.staleRetry);
      setSubmitting(false);
      return;
    }
    setError(res.error?.message ?? "Could not submit detail. Try again.");
    setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interrogation-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl">
        <h2 id="interrogation-title" className="text-lg font-bold text-[#0B1220]">
          {LANGUAGE.feedback.interrogation.title}
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">{LANGUAGE.feedback.interrogation.subtitle}</p>
        <p className="mt-3 text-sm font-medium text-[#0B1220]">{question}</p>

        <label className="mt-4 block text-xs font-semibold text-[#64748B]">
          {LANGUAGE.feedback.interrogation.detailLabel}
        </label>
        <textarea
          value={detail}
          disabled={submitting}
          onChange={(e) => setDetail(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm disabled:opacity-60"
          placeholder={LANGUAGE.feedback.interrogation.detailPlaceholder}
        />
        {detail.trim().length > 0 && detail.trim().length < CLARIFY_MIN ? (
          <p className="mt-1 text-xs text-[#94A3B8]">
            {detail.trim().length}/{CLARIFY_MIN} characters
          </p>
        ) : null}

        {error ? (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1220] py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LANGUAGE.feedback.interrogation.submitting}
              </>
            ) : (
              LANGUAGE.feedback.interrogation.submit
            )}
          </button>
          {onDismiss ? (
            <button
              type="button"
              disabled={submitting}
              onClick={onDismiss}
              className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#64748B]"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
