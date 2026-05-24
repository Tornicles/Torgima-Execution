import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/torgima-api";
import { getGetDashboardStateQueryKey } from "@workspace/api-client-react";
import { buttons } from "@/design";

type Verdict = "completed" | "partial" | "failed" | "skipped";

export function DashboardFeedbackForm({
  orderId,
  blueprintId,
  onSubmitted,
}: {
  orderId: string;
  blueprintId?: string | null;
  onSubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<Verdict | "">("");
  const [score, setScore] = useState(7);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!verdict) {
      setError("Select a verdict.");
      return;
    }
    if (!blueprintId) {
      setError("Blueprint context missing.");
      return;
    }
    if (reflection.trim().length < 10) {
      setError("Reflection must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiPost("/api/execution/feedback", {
        orderId,
        blueprintId,
        completionStatus: verdict,
        score,
        feedbackText: reflection,
      });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-gray-100 pt-5 mt-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Submit feedback</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {(["completed", "partial", "failed", "skipped"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            className={`py-2 rounded-lg text-xs font-medium transition-all capitalize ${
              verdict === v
                ? "bg-gray-900 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-400">Execution score</span>
          <span className="text-xs font-medium text-gray-700">{score}/10</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full accent-gray-900"
        />
      </div>

      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="What happened? What did you complete? Any blockers?"
        className="w-full text-sm border border-gray-200 rounded-lg p-3 mb-4 resize-none h-20 focus:outline-none focus:border-gray-400"
      />

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className={`w-full ${buttons.primary} disabled:opacity-50`}
      >
        {submitting ? "Submitting…" : "Submit & get next order"}
      </button>
    </div>
  );
}

export function GenerateFirstOrderButton({ blueprintId }: { blueprintId?: string | null }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!blueprintId) return;
    setLoading(true);
    setError("");
    try {
      await apiPost("/api/execution/next-task", { blueprintId });
      await queryClient.invalidateQueries({ queryKey: getGetDashboardStateQueryKey() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading || !blueprintId}
        className={`${buttons.secondary} text-sm`}
      >
        {loading ? "Generating…" : "Generate first order"}
      </button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
