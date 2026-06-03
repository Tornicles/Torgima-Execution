import { Link } from "wouter";
import { Play, MessageSquare, AlertTriangle, ArrowRight } from "lucide-react";
import { LANGUAGE } from "@/lib/language";

const ACTION_LABELS: Record<string, string> = {
  start: "Start",
  continue: "Continue",
  submit_feedback: LANGUAGE.feedback.title,
  report_blocked: LANGUAGE.task.block,
  view_details: "View details",
  refresh: LANGUAGE.actions.refresh,
};

export function ActionButtons({
  allowed,
  orderId,
  onStart,
  starting,
  onRefresh,
}: {
  allowed: string[];
  orderId: string;
  onStart?: () => void;
  starting?: boolean;
  onRefresh?: () => void;
}) {
  const set = new Set(allowed.map((a) => a.toLowerCase()));

  return (
    <div className="flex flex-wrap gap-3">
      {set.has("start") && onStart ? (
        <button
          type="button"
          disabled={starting}
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0B1220] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          {starting ? LANGUAGE.states.processing : ACTION_LABELS.start}
        </button>
      ) : null}
      {set.has("continue") ? (
        <Link href={`/tasks/${orderId}`}>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer hover:bg-[#15803D]">
            {ACTION_LABELS.continue}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      ) : null}
      {set.has("submit_feedback") ? (
        <Link href={orderId ? `/feedback/${orderId}` : "/feedback"}>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#5B21FF] px-5 py-2.5 text-sm font-semibold text-white cursor-pointer hover:bg-[#4C1D95]">
            <MessageSquare className="h-4 w-4" />
            {ACTION_LABELS.submit_feedback}
          </span>
        </Link>
      ) : null}
      {set.has("report_blocked") ? (
        <Link href={`/feedback/${orderId}`}>
          <span className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 cursor-pointer">
            <AlertTriangle className="h-4 w-4" />
            {ACTION_LABELS.report_blocked}
          </span>
        </Link>
      ) : null}
      {set.has("view_details") ? (
        <Link href={`/tasks/${orderId}`}>
          <span className="inline-flex items-center text-sm font-medium text-[#64748B] hover:text-[#0B1220] cursor-pointer">
            {ACTION_LABELS.view_details} →
          </span>
        </Link>
      ) : null}
      {set.has("refresh") && onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="text-sm font-semibold text-[#5B21FF] underline"
        >
          {ACTION_LABELS.refresh}
        </button>
      ) : null}
    </div>
  );
}
