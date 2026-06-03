import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MinusCircle, SkipForward, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { generateIdempotencyKey } from "@/api/client";
import { submitOrderFeedback } from "@/api/orders";
import { runDashboardMutation } from "@/lib/mutations";
import { invalidateDashboardProjection } from "@/lib/query-keys";
import { LANGUAGE } from "@/lib/language";
import {
  buildFeedbackPayload,
  COMPLETION_LABELS,
  initialProofState,
  proofValid,
} from "@/lib/task-feedback";
import type { FeedbackFormState, TaskExecutionView } from "@/types/task-execution";
import { useNetworkResilience } from "@/hooks/useNetworkResilience";
import {
  clearFeedbackDraft,
  loadFeedbackDraft,
  saveFeedbackDraft,
} from "@/lib/feedback-draft";
import { OptionalEffortInputs } from "./OptionalEffortInputs";
import { ProofInputs } from "./ProofInputs";

const COMPLETION_ICONS = {
  COMPLETED: CheckCircle2,
  PARTIAL: MinusCircle,
  FAILED: XCircle,
  BLOCKED: AlertTriangle,
  SKIPPED: SkipForward,
} as const;

export function FeedbackForm({
  order,
  stateVersion,
  onSuccess,
  compact,
}: {
  order: TaskExecutionView;
  stateVersion: number;
  onSuccess: () => void;
  compact?: boolean;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const idempotencyKey = useMemo(
    () => generateIdempotencyKey(`feedback-${order.orderId}`),
    [order.orderId],
  );

  const [form, setForm] = useState<FeedbackFormState>(() => {
    const draft = loadFeedbackDraft(order.orderId);
    if (draft) return { ...draft, proof: { ...draft.proof, ...initialProofState(order.proofType) } };
    return {
      completion: null,
      proof: initialProofState(order.proofType),
      score: 7,
      difficultyFelt: "moderate",
      reflection: "",
    };
  });
  const { online } = useNetworkResilience(() => {
    void invalidateDashboardProjection(queryClient);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const allowed = order.allowedFeedbackTypes;

  useEffect(() => {
    saveFeedbackDraft(order.orderId, form);
  }, [order.orderId, form]);

  function patchForm(patch: Partial<FeedbackFormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function patchProof(patch: Partial<FeedbackFormState["proof"]>) {
    setForm((f) => ({ ...f, proof: { ...f.proof, ...patch } }));
  }

  async function submit() {
    if (submitting) return;
    if (!form.completion) {
      setError(LANGUAGE.feedback.selectCompletion);
      return;
    }
    if (!proofValid(order, form.proof)) {
      setProofError(LANGUAGE.feedback.proofRequiredMessage);
      return;
    }
    if (
      (form.completion === "BLOCKED" || form.completion === "FAILED") &&
      !(form.blockerReason?.trim() || form.reflection?.trim() || form.userNotes?.trim())
    ) {
      setError(LANGUAGE.feedback.blockerRequired);
      return;
    }

    setSubmitting(true);
    setError(null);
    setProofError(null);

    const result = await runDashboardMutation(queryClient, (sv, _key) =>
      submitOrderFeedback(
        order.orderId,
        buildFeedbackPayload(order, form, sv, idempotencyKey) as Record<string, unknown> & {
          expectedStateVersion: number;
        },
      ),
    );

    if (result.ok) {
      const data = result.data as {
        requiresInterrogation?: boolean;
        feedbackId?: string;
        message?: string;
      };
      if (data?.requiresInterrogation && data.feedbackId) {
        setLocation(`/feedback/${order.orderId}?clarify=${data.feedbackId}`);
        setSubmitting(false);
        return;
      }
      clearFeedbackDraft(order.orderId);
      onSuccess();
      setLocation("/dashboard");
      return;
    }

    if (result.code === "STALE_STATE") {
      onSuccess();
      setError(LANGUAGE.feedback.staleRetry);
      setSubmitting(false);
      return;
    }

    setError(result.message);
    setSubmitting(false);
  }

  return (
    <div className={`space-y-5 ${compact ? "" : "rounded-2xl border border-[#ECECF4] bg-white p-5"}`}>
      <div>
        <h2 className="text-lg font-bold text-[#0B1220]">{LANGUAGE.feedback.title}</h2>
        <p className="text-sm text-[#64748B]">{LANGUAGE.feedback.subtitle}</p>
      </div>

      {!online ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" role="status">
          {LANGUAGE.feedback.offline}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
          {LANGUAGE.feedback.completionLabel}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {allowed.map((type) => {
            const Icon = COMPLETION_ICONS[type];
            const selected = form.completion === type;
            return (
              <button
                key={type}
                type="button"
                disabled={submitting}
                onClick={() => patchForm({ completion: type })}
                className={`text-left rounded-xl border-2 p-3 transition-colors ${
                  selected
                    ? "border-[#5B21FF] bg-[#F5F3FF]"
                    : "border-[#E2E8F0] hover:border-[#C7D2FE]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-[#0B1220]">
                  <Icon className="h-4 w-4 shrink-0" />
                  {COMPLETION_LABELS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ProofInputs
        order={order}
        proof={form.proof}
        onChange={patchProof}
        error={proofError}
      />

      {(form.completion === "BLOCKED" || form.completion === "FAILED") && (
        <div>
          <label className="text-xs font-semibold text-[#64748B]">
            {LANGUAGE.feedback.blockerDescribe}
          </label>
          <textarea
            value={form.blockerReason ?? ""}
            onChange={(e) => patchForm({ blockerReason: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#64748B]">{LANGUAGE.feedback.reflectionLabel}</p>
        <textarea
          value={form.reflection ?? ""}
          onChange={(e) => patchForm({ reflection: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
          placeholder={LANGUAGE.feedback.reflectionPlaceholder}
        />
      </div>

      <OptionalEffortInputs form={form} onChange={patchForm} />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void submit()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1220] py-3.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {LANGUAGE.feedback.submitting}
          </>
        ) : (
          LANGUAGE.feedback.submit
        )}
      </button>
    </div>
  );
}
