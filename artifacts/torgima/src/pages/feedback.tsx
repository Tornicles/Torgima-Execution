import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { CheckCircle2, XCircle, MinusCircle, SkipForward, AlertTriangle, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

const STATUS_OPTIONS = [
  {
    value: "completed",
    label: "Executed",
    sub: "Order fully executed with proof",
    icon: CheckCircle2,
    color: "border-green-500 bg-green-50",
    textColor: "text-green-700",
  },
  {
    value: "partial",
    label: "Partial",
    sub: "Execution started but not complete",
    icon: MinusCircle,
    color: "border-yellow-500 bg-yellow-50",
    textColor: "text-yellow-700",
  },
  {
    value: "failed",
    label: "Blocked",
    sub: "Execution blocked — cannot proceed",
    icon: XCircle,
    color: "border-red-500 bg-red-50",
    textColor: "text-red-700",
  },
  {
    value: "skipped",
    label: "Skipped",
    sub: "Chose not to execute this order",
    icon: SkipForward,
    color: "border-gray-300 bg-gray-50",
    textColor: "text-gray-600",
  },
];

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState("");
  const [score, setScore] = useState(7);
  const [reflection, setReflection] = useState("");
  const [blocker, setBlocker] = useState("");
  const [hasBlocker, setHasBlocker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!orderId || !API_BASE_URL) {
      setError("Missing order or server URL");
      return;
    }
    if (!status) {
      setError("Select an execution status");
      return;
    }
    if (reflection.length < 10) {
      setError("Reflection must be at least 10 characters — describe what actually happened");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completionStatus: status,
          score,
          reflection,
          blockerJson: hasBlocker && blocker ? { description: blocker, type: "manual" } : null,
          idempotencyKey: `feedback-${orderId}-${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setLocation("/dashboard");
      } else {
        setError(data.error?.message ?? "Submission failed");
      }
    } catch {
      setError("Cannot connect to execution server");
    } finally {
      setSubmitting(false);
    }
  }

  const scoreLabels: Record<number, string> = {
    0: "Zero execution",
    1: "Severe failure",
    2: "Poor execution",
    3: "Below standard",
    4: "Incomplete",
    5: "Partial execution",
    6: "Acceptable",
    7: "Good execution",
    8: "Strong execution",
    9: "Near-perfect",
    10: "Perfect execution",
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Execution report</h1>
        <p className="text-sm text-gray-500 mt-1">
          Signal fidelity requires precise reporting — the condition engine adapts to reality, not intent.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">Execution status</p>
        <div className="grid grid-cols-2 gap-3">
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = status === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`text-left border-2 rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected ? opt.color : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
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
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">Execution quality</p>
          <div className="text-right">
            <span className="text-3xl font-bold text-gray-900">{score}</span>
            <span className="text-sm text-gray-400">/10</span>
            <p className="text-xs text-gray-400 mt-0.5">{scoreLabels[score]}</p>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-gray-900"
        />
        <div className="flex justify-between text-xs text-gray-300 font-mono">
          <span>0 — No execution</span>
          <span>10 — Perfect execution</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider font-mono">Execution reflection</p>
        <p className="text-xs text-gray-400">Describe what happened in reality — what you did, what the output was, what changed.</p>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="What exactly did you execute? What was the output? What changed in reality as a result?"
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder:text-gray-300"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{reflection.length} chars</span>
          <span className={reflection.length < 30 ? "text-amber-500" : "text-green-500"}>
            {reflection.length < 10 ? "Too short" : reflection.length < 30 ? "Be more specific" : "Good detail"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setHasBlocker(!hasBlocker)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            hasBlocker ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${hasBlocker ? "text-orange-500" : "text-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700">Execution chain blocker detected</span>
          <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${hasBlocker ? "rotate-90 text-orange-500" : "text-gray-300"}`} />
        </button>
        {hasBlocker ? (
          <input
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder="Describe the exact blocker — what prevented execution?"
            className="w-full border border-orange-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        ) : null}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-sm font-mono">{error}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !status}
        className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-40 transition-all text-sm uppercase tracking-wider"
      >
        {submitting ? "Submitting report..." : "Submit execution report →"}
      </button>

      <p className="text-center text-xs text-gray-400 font-mono">
        Honest reporting improves signal calibration. The system prioritizes observable execution reality.
      </p>
    </div>
  );
}
