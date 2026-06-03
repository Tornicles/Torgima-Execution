import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { afterMutationSuccess } from "@/lib/mutations";
import { buttons } from "@/design";
import type { TaskRealityState } from "@/lib/structured-feedback-api";

const TASK_STATES: TaskRealityState[] = [
  "Finished",
  "Partly Done",
  "Started",
  "Not Started",
  "Blocked",
  "Skipped",
];

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
  const [taskState, setTaskState] = useState<TaskRealityState | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!taskState) {
      setError("Select what happened with this task.");
      return;
    }
    if (!blueprintId) {
      setError("Blueprint context missing.");
      return;
    }

    setSubmitting(true);
    setError("");

    const start = await apiFetchEnvelope<{
      session: { id: string } | null;
    }>("/api/feedback/start", {
      method: "POST",
      body: JSON.stringify({ blueprintId, triggerType: "task_finish" }),
    });

    if (!start.ok || !start.data?.session?.id) {
      setError(start.error?.message ?? "Could not start feedback session");
      setSubmitting(false);
      return;
    }

    const res = await apiFetchEnvelope("/api/feedback/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: start.data.session.id,
        realitySummary: note.trim() || `Quick feedback for task: ${taskState}`,
        taskStates: [{ task_id: orderId, state: taskState }],
        emotionalState: ["Good"],
        frictionType: taskState === "Blocked" ? ["task_too_hard"] : ["nothing_blocked"],
        outputType: taskState === "Finished" ? ["improved"] : ["no_tangible_output"],
      }),
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error?.message ?? "Submission failed.");
      return;
    }

    await afterMutationSuccess(queryClient);
    onSubmitted?.();
  }

  return (
    <div className="border-t border-gray-100 pt-5 mt-5">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">What happened with this task?</p>
      <p className="text-xs text-gray-500 mb-3">No score — pick what actually happened.</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {TASK_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTaskState(s)}
            className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              taskState === s ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: what happened in a sentence?"
        className="w-full text-sm border border-gray-200 rounded-lg p-3 mb-4 resize-none h-16 focus:outline-none focus:border-gray-400"
      />

      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleSubmit()}
        className={`${buttons.primary} w-full`}
      >
        {submitting ? "Submitting…" : "Submit reality feedback"}
      </button>
    </div>
  );
}
