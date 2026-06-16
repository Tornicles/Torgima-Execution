import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  MinusCircle,
  SkipForward,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { generateIdempotencyKey } from "@/api/client";
import { submitOrderFeedback } from "@/api/orders";
import { runDashboardMutation } from "@/lib/mutations";
import { LANGUAGE } from "@/lib/language";
import { BLUEPRINT_LABELS } from "@/lib/language-map";
import {
  buildFeedbackPayload,
  COMPLETION_LABELS,
  DIFFICULTY_FELT_LABELS,
  initialProofState,
  proofValid,
  reflectionValid,
  REFLECTION_MIN_LENGTH,
  scoreRequiredFor,
} from "@/lib/task-feedback";
import type {
  DifficultyFelt,
  FeedbackCompletion,
  FeedbackFormState,
  TaskExecutionView,
} from "@/types/task-execution";
import { useNetworkResilience } from "@/hooks/useNetworkResilience";
import {
  clearFeedbackDraft,
  loadFeedbackDraft,
  saveFeedbackDraft,
} from "@/lib/feedback-draft";
import { ProofUpload } from "./ProofUpload";
import { InterrogationPrompt } from "./InterrogationPrompt";
import { ProofInputs } from "./ProofInputs";

const COMPLETION_ICONS = {
  COMPLETED: CheckCircle2,
  PARTIAL: MinusCircle,
  FAILED: XCircle,
  BLOCKED: AlertTriangle,
  SKIPPED: SkipForward,
} as const;

const DIFFICULTY_FELT_OPTIONS: DifficultyFelt[] = [
  "too_easy",
  "about_right",
  "hard",
  "too_hard",
];

export function FeedbackForm({
  order,
  stateVersion,
  onSuccess,
  compact,
  initialCompletion,
  onCancel,
}: {
  order: TaskExecutionView;
  stateVersion: number;
  onSuccess: () => void;
  compact?: boolean;
  initialCompletion?: FeedbackCompletion;
  onCancel?: () => void;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const idempotencyKey = useMemo(
    () => generateIdempotencyKey(`feedback-${order.orderId}`),
    [order.orderId],
  );

  const [form, setForm] = useState<FeedbackFormState>(() => {
    const draft = loadFeedbackDraft(order.orderId);
    const base: FeedbackFormState = draft
      ? { ...draft, proof: { ...draft.proof, ...initialProofState(order.proofType) } }
      : {
          completion: initialCompletion ?? null,
          proof: initialProofState(order.proofType),
          score: 7,
          difficultyFelt: "about_right",
          reflection: "",
        };
    if (initialCompletion) base.completion = initialCompletion;
    return base;
  });

  const { online } = useNetworkResilience(() => {
    void queryClient.invalidateQueries();
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [interrogation, setInterrogation] = useState<{
    feedbackId: string;
    question: string;
  } | null>(null);

  const allowed = order.allowedFeedbackTypes;
  const formDisabled = submitting || Boolean(interrogation);
  const reflectionLen = form.reflection?.trim().length ?? 0;
  const needsReflection =
    form.completion !== "SKIPPED" && form.completion !== "BLOCKED";
  const proofOk = proofValid(order, form.proof);
  const canSubmit =
    Boolean(form.completion) &&
    (!needsReflection || reflectionValid(form.reflection)) &&
    (form.completion !== "BLOCKED" || Boolean(form.blockerReason?.trim())) &&
    proofOk &&
    !submitting &&
    !interrogation;

  useEffect(() => {
    saveFeedbackDraft(order.orderId, form);
  }, [order.orderId, form]);

  useEffect(() => {
    if (initialCompletion) {
      setForm((f) => ({ ...f, completion: initialCompletion }));
    }
  }, [initialCompletion]);

  function patchForm(patch: Partial<FeedbackFormState>) {
    setForm((f) => ({ ...f, ...patch }));
    setReflectionError(null);
    setProofError(null);
    setError(null);
  }

  function patchProof(patch: Partial<FeedbackFormState["proof"]>) {
    setForm((f) => ({ ...f, proof: { ...f.proof, ...patch } }));
    setProofError(null);
  }

  async function submit() {
    if (submitting) return;
    setFieldErrors({});

    if (!form.completion) {
      setError(LANGUAGE.feedback.selectCompletion);
      return;
    }
    if (needsReflection && !reflectionValid(form.reflection)) {
      setReflectionError(LANGUAGE.feedback.reflectionTooShort);
      return;
    }
    if (form.completion === "BLOCKED" && !form.blockerReason?.trim()) {
      setError(LANGUAGE.feedback.blockerRequired);
      return;
    }
    if (!proofOk) {
      setProofError(LANGUAGE.feedback.proofRequiredMessage);
      return;
    }

    setSubmitting(true);
    setError(null);
    setProofError(null);
    setReflectionError(null);

    const result = await runDashboardMutation(queryClient, (sv) =>
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
        interrogationQuestion?: string | null;
        message?: string;
      };
      if (data?.requiresInterrogation && data.feedbackId) {
        setInterrogation({
          feedbackId: data.feedbackId,
          question:
            data.interrogationQuestion ??
            data.message ??
            "Can you add a bit more detail about what you did?",
        });
        setSubmitting(false);
        return;
      }
      clearFeedbackDraft(order.orderId);
      onSuccess();
      setLocation("/dashboard");
      return;
    }

    if (result.code === "STALE_STATE") {
      setError(LANGUAGE.feedback.staleRetry);
      setSubmitting(false);
      return;
    }

    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
    }
    setError(result.message);
    setSubmitting(false);
  }

  const useLegacyProof =
    order.proofType === "STEPS" || order.proofType === "OUTPUT";

  return (
    <div
      className={`relative space-y-5 ${compact ? "" : "rounded-2xl border border-[#ECECF4] bg-white p-5"}`}
      aria-label={BLUEPRINT_LABELS.feedback}
    >
      {interrogation ? (
        <InterrogationPrompt
          feedbackId={interrogation.feedbackId}
          question={interrogation.question}
          onSuccess={() => {
            clearFeedbackDraft(order.orderId);
            onSuccess();
            setLocation("/dashboard");
          }}
        />
      ) : null}

      <fieldset disabled={formDisabled} className="space-y-5 border-0 p-0 m-0 min-w-0">
        <div>
          <h2 className="text-lg font-bold text-[#0B1220]">{LANGUAGE.feedback.title}</h2>
          <p className="text-sm text-[#64748B]">{LANGUAGE.feedback.subtitle}</p>
        </div>

        {!online ? (
          <p
            className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
            role="status"
          >
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

        {form.completion && scoreRequiredFor(form.completion) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#64748B]">{LANGUAGE.feedback.scoreLabel}</p>
              <span className="text-sm font-bold text-[#0B1220]">{form.score ?? 0}/10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={form.score ?? 7}
              onChange={(e) => patchForm({ score: Number(e.target.value) })}
              className="w-full accent-[#5B21FF]"
            />
            <div className="flex justify-between text-xs text-[#94A3B8]">
              <span>0 — {LANGUAGE.feedback.scoreFailed}</span>
              <span>5 — {LANGUAGE.feedback.scoreAcceptable}</span>
              <span>10 — {LANGUAGE.feedback.scoreExcellent}</span>
            </div>
          </div>
        ) : null}

        {form.completion ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748B]">{LANGUAGE.feedback.difficultyLabel}</p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_FELT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => patchForm({ difficultyFelt: opt })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    form.difficultyFelt === opt
                      ? "border-[#5B21FF] bg-[#F5F3FF] text-[#4338CA]"
                      : "border-[#E2E8F0] text-[#475569]"
                  }`}
                >
                  {DIFFICULTY_FELT_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {useLegacyProof ? (
          <ProofInputs order={order} proof={form.proof} onChange={patchProof} error={proofError} />
        ) : (
          <ProofUpload
            order={order}
            proof={form.proof}
            onChange={patchProof}
            disabled={formDisabled}
            error={proofError}
          />
        )}

        {form.completion === "BLOCKED" ? (
          <div>
            <label className="text-xs font-semibold text-[#64748B]">
              {LANGUAGE.feedback.blockerDescribe}
            </label>
            <textarea
              value={form.blockerReason ?? ""}
              onChange={(e) => patchForm({ blockerReason: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
              aria-invalid={Boolean(fieldErrors.blockerReason)}
            />
          </div>
        ) : null}

        {needsReflection ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#64748B]">{LANGUAGE.feedback.reflectionLabel}</p>
            <textarea
              value={form.reflection ?? ""}
              onChange={(e) => patchForm({ reflection: e.target.value })}
              rows={4}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
              placeholder={LANGUAGE.feedback.reflectionPlaceholder}
              aria-invalid={Boolean(reflectionError || fieldErrors.reflection)}
            />
            {reflectionLen < 30 ? (
              <p className="text-xs text-[#94A3B8]">
                {reflectionLen}/{REFLECTION_MIN_LENGTH} {LANGUAGE.feedback.minCharacters}
              </p>
            ) : null}
            <p className="text-xs text-[#94A3B8]">{LANGUAGE.feedback.reflectionHintDetail}</p>
            {reflectionError ? (
              <p className="text-sm text-red-700" role="alert">
                {reflectionError}
              </p>
            ) : null}
            {fieldErrors.reflection?.[0] ? (
              <p className="text-sm text-red-700" role="alert">
                {fieldErrors.reflection[0]}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {!proofOk && order.proofRequired ? (
          <p className="text-sm text-amber-800" role="status">
            {LANGUAGE.feedback.proofRequiredMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          {onCancel ? (
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#64748B]"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1220] py-3.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {LANGUAGE.feedback.processing}
              </>
            ) : (
              LANGUAGE.feedback.submit
            )}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
