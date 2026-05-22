import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-base";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, MinusCircle, SkipForward, AlertTriangle, ChevronRight } from "lucide-react";
import {
  getOrder,
  submitExecutionFeedback,
  submitOrderFeedback,
  answerFeedbackInterrogation,
  getGetDashboardStateQueryKey,
} from "@/lib/torgima-api";

const STATUS_OPTIONS = [
  { value: "completed", label: "Executed", sub: "Order fully executed with proof", icon: CheckCircle2, color: "border-green-500 bg-green-50", textColor: "text-green-700" },
  { value: "partial", label: "Partial", sub: "Execution started but not complete", icon: MinusCircle, color: "border-yellow-500 bg-yellow-50", textColor: "text-yellow-700" },
  { value: "failed", label: "Blocked", sub: "Execution blocked — cannot proceed", icon: XCircle, color: "border-red-500 bg-red-50", textColor: "text-red-700" },
  { value: "skipped", label: "Skipped", sub: "Chose not to execute this order", icon: SkipForward, color: "border-gray-300 bg-gray-50", textColor: "text-gray-600" },
];

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [score, setScore] = useState(7);
  const [reflection, setReflection] = useState("");
  const [proofText, setProofText] = useState("");
  const [blocker, setBlocker] = useState("");
  const [hasBlocker, setHasBlocker] = useState(false);
  const [proofRequired, setProofRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [interrogation, setInterrogation] = useState<{ feedbackId: string; question?: string } | null>(null);
  const [interrogationAnswer, setInterrogationAnswer] = useState("");
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [postSubmit, setPostSubmit] = useState<{
    message: string;
    nextOrderId?: string;
    condition?: string;
  } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void getOrder(orderId)
      .then((d) => {
        setProofRequired(Boolean((d as { proofRequired?: boolean }).proofRequired));
        const bp = (d as { blueprintId?: string }).blueprintId;
        if (bp) setBlueprintId(bp);
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
    if (proofRequired && proofText.trim().length < 5) return "Proof is required for this order";
    return null;
  }

  async function submit() {
    if (!orderId) {
      setError("Missing order");
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
      const started = Date.now();
      const usePrimaryLoop = Boolean(blueprintId);
      const res = await fetch(
        usePrimaryLoop ?
          `${API_BASE_URL}/api/execution/feedback`
        : `${API_BASE_URL}/api/orders/${orderId}/feedback`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            usePrimaryLoop ?
              {
                orderId,
                blueprintId,
                completionStatus: status,
                score,
                feedbackText: reflection,
              }
            : {
                completionStatus: status,
                score,
                reflection,
                proofJson: proofText.trim() ? { text: proofText } : undefined,
                blockerJson: status === "failed" || hasBlocker ? { description: blocker, type: "manual" } : null,
                idempotencyKey: `feedback-${orderId}-${Date.now()}`,
              },
          ),
        },
      );

      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Submission failed");
        return;
      }

      const result = data.data as {
        requiresInterrogation?: boolean;
        feedbackId?: string;
        interrogationQuestion?: string;
        nextOrderId?: string;
      };

      if (result?.requiresInterrogation && result.feedbackId) {
        setInterrogation({
          feedbackId: result.feedbackId,
          question: result.interrogationQuestion,
        });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });

      if (usePrimaryLoop) {
        const elapsed = Date.now() - started;
        const waitMs = Math.max(0, 3000 - elapsed);
        await new Promise((r) => setTimeout(r, waitMs));
        setPostSubmit({
          message: "Execution continuity maintained.",
          nextOrderId: result.nextOrderId,
        });
        return;
      }

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
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Report received</h1>
        <p className="text-sm text-green-700 font-medium">{postSubmit.message}</p>
        {postSubmit.nextOrderId ? (
          <button
            type="button"
            onClick={() => setLocation(`/tasks/${postSubmit.nextOrderId}`)}
            className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl"
          >
            View next Order →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl"
          >
            Return to dashboard
          </button>
        )}
      </div>
    );
  }

  if (interrogation) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Execution report</h1>
        <p className="text-sm text-gray-500 mt-1">Honest reporting drives the next execution order.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution status</p>
        <div className="grid grid-cols-2 gap-3">
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
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution quality</p>
        <input type="range" min={0} max={10} value={score} onChange={(e) => setScore(Number(e.target.value))} className="w-full accent-gray-900" />
        <p className="text-center text-2xl font-bold">{score}/10</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reflection {score < 6 ? "(required)" : ""}</p>
        <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm" />
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
        <input value={blocker} onChange={(e) => setBlocker(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm" placeholder="What blocked execution?" />
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button type="button" onClick={() => void submit()} disabled={submitting} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl disabled:opacity-40">
        {submitting ? "Submitting…" : "Submit execution report"}
      </button>
    </div>
  );
}
