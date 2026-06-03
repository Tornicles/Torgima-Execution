import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { FeedbackDashboardView } from "@/components/views/feedback/FeedbackDashboardView";
import { useQueryClient } from "@tanstack/react-query";
import { fetchOrderDetail } from "@/api/orders";
import { answerFeedbackInterrogation } from "@/lib/torgima-api";
import { FeedbackForm } from "@/components/tasks/FeedbackForm";
import { TaskSkeleton } from "@/components/tasks/TaskSkeleton";
import { BlockedTaskState } from "@/components/tasks/BlockedTaskState";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
import { parseTaskExecutionView } from "@/lib/task-feedback";
import { afterMutationSuccess, onMutationError } from "@/lib/mutations";
import type { TaskExecutionView } from "@/types/task-execution";

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
  const { stateVersion, invalidate } = useDashboardProjection();
  const [execution, setExecution] = useState<TaskExecutionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [interrogation, setInterrogation] = useState<{ feedbackId: string; question?: string } | null>(
    null,
  );
  const [interrogationAnswer, setInterrogationAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchOrderDetail(orderId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLocation("/dashboard");
        return;
      }
      const view = parseTaskExecutionView(res.data);
      if (!view) {
        setLocation("/dashboard");
        return;
      }
      setExecution(view);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, setLocation]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clarifyId = params.get("clarify");
    if (clarifyId) {
      setInterrogation({ feedbackId: clarifyId });
    }
  }, []);

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
      await afterMutationSuccess(queryClient);
      setLocation("/dashboard");
    } catch (err) {
      const kind = await onMutationError(queryClient, err);
      if (kind === "stale") {
        invalidate();
        setError("State refreshed — please answer again.");
        return;
      }
      if (kind === "auth") return;
      setError("Cannot connect to execution server");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <TaskSkeleton />;

  if (!execution) return null;

  if (execution.blocked) {
    return (
      <BlockedTaskState reason={execution.disabledReason} onRefresh={invalidate} />
    );
  }

  if (interrogation) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-gray-900">Clarification required</h1>
        <p className="text-sm text-gray-600">
          {interrogation.question ??
            "Your report needs more detail before the execution loop can continue."}
        </p>
        <textarea
          value={interrogationAnswer}
          onChange={(e) => setInterrogationAnswer(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          placeholder="Provide the missing detail…"
        />
        {error ? <p className="text-red-600 text-sm">{error}</p> : null}
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
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <FeedbackForm
        order={execution}
        stateVersion={stateVersion}
        onSuccess={invalidate}
      />
    </div>
  );
}
