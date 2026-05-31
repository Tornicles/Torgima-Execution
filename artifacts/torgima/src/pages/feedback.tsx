import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { FeedbackDashboardView } from "@/components/views/feedback/FeedbackDashboardView";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MinusCircle, SkipForward, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import {
  getOrder,
  submitOrderFeedback,
  answerFeedbackInterrogation,
  getGetDashboardStateQueryKey,
  getDashboardState,
} from "@/lib/torgima-api";
import { LANGUAGE } from "@/lib/language";

const DIFFICULTY_OPTIONS = (
  Object.entries(LANGUAGE.task.difficulty) as Array<
    [keyof typeof LANGUAGE.task.difficulty, string]
  >
).map(([value, label]) => ({ value, label }));

const STATUS_OPTIONS = [
  { value: "completed", label: LANGUAGE.task.completion.completed, sub: "Fully completed with proof", icon: CheckCircle2, color: "border-green-500 bg-green-50", textColor: "text-green-700" },
  { value: "partial", label: LANGUAGE.task.completion.partial, sub: "Started but not finished", icon: MinusCircle, color: "border-yellow-500 bg-yellow-50", textColor: "text-yellow-700" },
  { value: "failed", label: LANGUAGE.task.completion.blocked, sub: "Something blocked progress", icon: XCircle, color: "border-red-500 bg-red-50", textColor: "text-red-700" },
  { value: "skipped", label: LANGUAGE.task.completion.skipped, sub: "Chose not to do this step", icon: SkipForward, color: "border-gray-300 bg-gray-50", textColor: "text-gray-600" },
];

const BLOCKER_OPTIONS = Object.entries(LANGUAGE.feedback.blockerTypes).map(([value, label]) => ({
  value,
  label,
}));

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  if (!orderId) {
    return <FeedbackDashboardView />;
  }
  return <OrderFeedbackForm orderId={orderId} />;
}

function OrderFeedbackForm({ orderId }: { orderId: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [score, setScore] = useState(7);
  const [difficultyFelt, setDifficultyFelt] = useState("moderate");
  const [blockerType, setBlockerType] = useState("other");
  const [reflection, setReflection] = useState("");
  const [proofText, setProofText] = useState("");
  const [blocker, setBlocker] = useState("");
  const [hasBlocker, setHasBlocker] = useState(false);
  const [proofRequired, setProofRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [interrogation, setInterrogation] = useState<{ feedbackId: string; question?: string } | null>(null);
  const [interrogationAnswer, setInterrogationAnswer] = useState("");
  const [postSubmit, setPostSubmit] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void getOrder(orderId)
      .then((d) => {
        setProofRequired(Boolean((d as { proofRequired?: boolean }).proofRequired));
      })
      .catch(() => null);
  }, [orderId]);

  function validate(): string | null {
    if (!status) return "Select an execution status";
    if (status === "failed" && !blocker.trim() && !hasBlocker) return "Describe what blocked execution";
    if (score < 6 && reflection.trim().length < 20) return "Reflection required when score is below 6";
    if (reflection.length < 10) return "Reflection must be at least 10 characters";
    if (status === "completed" && score <= 2) return "Score is too low for a completed execution";
    if (status === "failed" && score >= 9) return "Cannot report failed execution with a score of 9–10";
    if (proofRequired && proofText.trim().length < 5) return "Please add your evidence (at least a few characters).";
    return null;
  }

  async function submit() {
    if (!orderId) {
      setError(LANGUAGE.errors.taskNotAvailable);
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const envelope = await submitOrderFeedback(orderId, {
        completionStatus: status as "completed" | "partial" | "failed" | "skipped",
        score,
        reflection,
        proofJson: proofText.trim() ? { text: proofText } : undefined,
        blockerJson:
          status === "failed" || hasBlocker
            ? { description: blocker, type: blockerType || "other" }
            : undefined,
        idempotencyKey: `feedback-${orderId}-${Date.now()}`,
        difficultyFelt,
      } as Parameters<typeof submitOrderFeedback>[1]);

      const result = envelope.data as
        | {
            requiresInterrogation?: boolean;
            feedbackId?: string;
            interrogationQuestion?: string | null;
            message?: string;
          }
        | undefined;

      if (result?.requiresInterrogation && result.feedbackId) {
        setInterrogation({
          feedbackId: result.feedbackId,
          question: result.interrogationQuestion ?? undefined,
        });
        return;
      }

      setPostSubmit({
        message: result?.message ?? "Feedback received. Preparing your next step…",
      });

      await new Promise((r) => setTimeout(r, 2000));
      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
      await getDashboardState().catch(() => null);
      setLocation("/dashboard");
    } catch {
      setError("Cannot connect to execution server");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInterrogation() {
    if (!interrogation || interrogationAnswer.trim().length < 5) {
      setError("Please answer the clarification question (at least 5 characters)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await answerFeedbackInterrogation(interrogation.feedbackId, {
        answer: interrogationAnswer,
        idempotencyKey: `interrogation-${interrogation.feedbackId}`,
      });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
      setLocation("/dashboard");
    } catch {
      setError("Cannot connect to execution server");
    } finally {
      setSubmitting(false);
    }
  }

  const scoreLabels: Record<number, string> = {
    0: "Zero execution", 5: "Partial execution", 7: "Good execution", 10: "Perfect execution",
  };

  if (postSubmit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 space-y-4 text-center shadow-xl">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Report received</h1>
          <p className="text-sm text-green-700 font-medium">{postSubmit.message}</p>
          <p className="text-xs text-gray-500">Refreshing your execution queue…</p>
        </div>
      </div>
    );
  }

  if (interrogation) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900">Clarification required</h1>
        <p className="text-sm text-gray-600">
          {interrogation.question ?? "Your report needs more detail before the execution loop can continue."}
        </p>
        <textarea
          value={interrogationAnswer}
          onChange={(e) => setInterrogationAnswer(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          placeholder="Provide the missing detail…"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="button"
          onClick={() => void submitInterrogation()}
          disabled={submitting}
          className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit clarification"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{LANGUAGE.feedback.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{LANGUAGE.feedback.subtitle}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution status</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = status === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`text-left border-2 rounded-xl p-4 transition-all ${isSelected ? opt.color : "border-gray-200 hover:border-gray-300 bg-white"}`}
              >
                <div className={`flex items-center gap-2 mb-1 ${isSelected ? opt.textColor : "text-gray-700"}`}>
                  <opt.icon className="w-4 h-4" />
                  <span className="font-bold text-sm">{opt.label}</span>
                </div>
                <p className={`text-xs ${isSelected ? opt.textColor : "text-gray-400"}`}>{opt.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution quality (1–10)</p>
        <input type="range" min={1} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} className="w-full accent-gray-900" />
        <p className="text-center text-2xl font-bold">{score}/10</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {LANGUAGE.feedback.difficultyLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => setDifficultyFelt(opt.value)}
              className={`text-xs px-3 py-2 rounded-lg border-2 font-medium transition-all ${
                difficultyFelt === opt.value
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {LANGUAGE.feedback.reflectionLabel} {score < 6 ? "(required)" : ""}
        </p>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          placeholder={LANGUAGE.feedback.reflectionPlaceholder}
        />
      </div>

      {proofRequired && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase">Proof (required)</p>
          <textarea value={proofText} onChange={(e) => setProofText(e.target.value)} rows={2} className="w-full border border-amber-300 rounded-xl px-4 py-3 text-sm" placeholder="Describe or link proof of execution" />
        </div>
      )}

      <button type="button" onClick={() => setHasBlocker(!hasBlocker)} className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">Report blocker</span>
        <ChevronRight className={`w-4 h-4 ml-auto ${hasBlocker ? "rotate-90" : ""}`} />
      </button>
      {hasBlocker && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase">
            {LANGUAGE.feedback.blockerTypeLabel}
          </label>
          <select
            value={blockerType}
            onChange={(e) => setBlockerType(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm"
          >
            {BLOCKER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm"
            placeholder={LANGUAGE.feedback.reflectionPlaceholder}
          />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={submitting} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl disabled:opacity-40">
        {submitting ? LANGUAGE.feedback.submitting : LANGUAGE.feedback.submit}
      </button>
    </div>
  );
}
