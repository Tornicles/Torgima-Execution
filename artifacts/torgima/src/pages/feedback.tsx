import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { CheckCircle2, XCircle, MinusCircle, SkipForward, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

const COMPLETION_OPTIONS = [
  {
    value: "completed",
    label: "Completed",
    description: "Task fully executed with proof",
    icon: CheckCircle2,
    color: "border-green-500 bg-green-50 text-green-700",
  },
  {
    value: "partial",
    label: "Partial",
    description: "Started but not fully complete",
    icon: MinusCircle,
    color: "border-yellow-500 bg-yellow-50 text-yellow-700",
  },
  {
    value: "failed",
    label: "Failed",
    description: "Could not complete — blocked",
    icon: XCircle,
    color: "border-red-500 bg-red-50 text-red-700",
  },
  {
    value: "skipped",
    label: "Skipped",
    description: "Chose not to execute",
    icon: SkipForward,
    color: "border-gray-400 bg-gray-50 text-gray-600",
  },
] as const;

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const [completionStatus, setCompletionStatus] = useState("");
  const [score, setScore] = useState(7);
  const [reflection, setReflection] = useState("");
  const [blocker, setBlocker] = useState("");
  const [hasBlocker, setHasBlocker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!orderId) {
      setError("Missing order");
      return;
    }
    if (!completionStatus) {
      setError("Select a completion status");
      return;
    }
    if (reflection.length < 10) {
      setError("Reflection must be at least 10 characters");
      return;
    }
    if (!API_BASE_URL) {
      setError("API not configured");
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
          completionStatus,
          score,
          reflection,
          blockerJson: hasBlocker && blocker ? { description: blocker, type: "manual" } : null,
          idempotencyKey: `feedback-${orderId}-${Date.now()}`,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: { message?: string } };

      if (data.ok) {
        setLocation("/dashboard");
      } else {
        setError(data.error?.message ?? "Submission failed");
      }
    } catch {
      setError("Cannot connect to server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Execution Report</h1>
        <p className="text-gray-500 text-sm mt-1">Report honestly. The system adapts to your reality.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">How did execution go?</p>
        <div className="grid grid-cols-2 gap-3">
          {COMPLETION_OPTIONS.map((opt) => {
            const isSelected = completionStatus === opt.value;
            const Icon = opt.icon;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setCompletionStatus(opt.value)}
                className={`text-left border-2 rounded-xl p-4 cursor-pointer transition-all ${
                  isSelected ? opt.color : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-5 h-5" />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </div>
                <p className="text-xs opacity-70">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Execution Quality</p>
          <span className="text-2xl font-bold text-gray-900">
            {score}
            <span className="text-sm text-gray-400">/10</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-green-500"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Poor execution</span>
          <span>Perfect execution</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Reflection</p>
        <p className="text-xs text-gray-400">What happened? What did you do? What was the result?</p>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Describe what you executed, what the outcome was, and what you learned..."
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-300"
        />
        <p className="text-xs text-gray-400 text-right">
          {reflection.length} chars {reflection.length < 30 ? "— be more specific" : ""}
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setHasBlocker(!hasBlocker)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left ${
            hasBlocker ? "border-orange-300 bg-orange-50" : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${hasBlocker ? "text-orange-500" : "text-gray-400"}`} />
          <span className="text-sm font-medium text-gray-700">I encountered a blocker</span>
        </button>
        {hasBlocker && (
          <input
            value={blocker}
            onChange={(e) => setBlocker(e.target.value)}
            placeholder="Describe what blocked you..."
            className="w-full border border-orange-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !completionStatus}
        className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 disabled:opacity-40 transition-all text-sm uppercase tracking-wider"
      >
        {submitting ? "Submitting…" : "Submit Execution Report →"}
      </button>
    </div>
  );
}
