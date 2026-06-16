import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Clock } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import type { FeedbackCompletion, TaskExecutionView } from "@/types/task-execution";
import { FeedbackForm } from "./FeedbackForm";

function difficultyLabel(raw: string): string {
  const key = raw.toLowerCase().replace(/-/g, "_") as keyof typeof LANGUAGE.task.difficulty;
  return LANGUAGE.task.difficulty[key] ?? raw;
}

function checklistItems(order: TaskExecutionView): string[] {
  if (order.successCriteria.length) return order.successCriteria;
  if (order.definitionOfDone) {
    return order.definitionOfDone
      .split(/\n|•|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** DOC 34 — task card with state-aware actions and feedback entry points. */
export function TaskExecutionScreen({
  order,
  stateVersion,
  onRefresh,
}: {
  order: TaskExecutionView;
  stateVersion: number;
  onRefresh: () => void;
}) {
  const [feedbackMode, setFeedbackMode] = useState<FeedbackCompletion | null>(null);
  const status = order.status ?? "active";
  const isCompleted = status === "completed";
  const needsFeedback = status === "needs_feedback" || status === "needs_clarification";
  const isBlocked = status === "blocked" || order.blocked;
  const showActions = !isCompleted && !feedbackMode;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-[#0B1220]">{order.title}</h1>
        {order.whyItMatters ? (
          <p className="text-sm italic text-[#64748B]">{order.whyItMatters}</p>
        ) : null}
      </div>

      {needsFeedback ? (
        <p
          className="rounded-xl border border-[#C7D2FE] bg-[#F5F3FF] px-4 py-3 text-sm font-medium text-[#4338CA]"
          role="status"
        >
          {LANGUAGE.task.needsFeedbackPrompt}
        </p>
      ) : null}

      {isCompleted ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {LANGUAGE.task.completion.completed}
          </p>
          {order.completionSummary ? (
            <p className="text-sm text-green-800">
              <span className="font-medium">{LANGUAGE.task.completionSummaryLabel}: </span>
              {order.completionSummary}
            </p>
          ) : null}
        </div>
      ) : null}

      {isBlocked && order.disabledReason ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          {order.disabledReason}
        </div>
      ) : null}

      {!isCompleted ? (
        <>
          <div className="space-y-2">
            <p className="text-base leading-relaxed text-[#0B1220]">{order.instruction}</p>
          </div>

          {order.expectedOutput ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFAFC] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                {LANGUAGE.task.expectedOutputLabel}
              </p>
              <p className="mt-2 text-sm text-[#0B1220]">{order.expectedOutput}</p>
            </div>
          ) : null}

          {checklistItems(order).length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                {LANGUAGE.task.definitionOfDoneLabel}
              </p>
              <ul className="space-y-2">
                {checklistItems(order).map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-[#0B1220]"
                  >
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[#CBD5E1]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm text-[#64748B]">
            <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#475569]">
              {difficultyLabel(order.difficulty)}
            </span>
            {order.timeEstimateMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden />
                {order.timeEstimateMinutes} min
              </span>
            ) : null}
          </div>

          {order.proofRequired ? (
            <p className="text-sm text-amber-900">
              {LANGUAGE.task.proofWillNeed} {order.proofInstruction || "file or link"}
            </p>
          ) : null}
        </>
      ) : null}

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => setFeedbackMode("COMPLETED")}
            className="flex-1 rounded-xl bg-[#0B1220] px-4 py-3 text-sm font-bold text-white"
          >
            {LANGUAGE.task.finishedTask}
          </button>
          <button
            type="button"
            onClick={() => setFeedbackMode("BLOCKED")}
            className="flex-1 rounded-xl border border-orange-300 px-4 py-3 text-sm font-semibold text-orange-800"
          >
            {LANGUAGE.task.hitProblem}
          </button>
          <button
            type="button"
            onClick={() => setFeedbackMode("FAILED")}
            className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-3 text-sm font-semibold text-[#475569]"
          >
            {LANGUAGE.task.triedFailed}
          </button>
        </div>
      ) : null}

      {feedbackMode ? (
        <FeedbackForm
          order={order}
          stateVersion={stateVersion}
          onSuccess={onRefresh}
          initialCompletion={feedbackMode}
          onCancel={() => setFeedbackMode(null)}
        />
      ) : null}

      <Link href="/dashboard">
        <span className="text-sm font-semibold text-[#5B21FF] underline cursor-pointer">
          {LANGUAGE.task.backToDashboard}
        </span>
      </Link>
    </div>
  );
}
