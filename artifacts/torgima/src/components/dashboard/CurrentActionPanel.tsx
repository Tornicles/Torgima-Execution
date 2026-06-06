import type { DashboardUiState } from "@/lib/dashboard-types";
import { LANGUAGE } from "@/lib/language";
import type { OrderSummary } from "@/types/dashboard";
import { ActionButtons } from "./ActionButtons";
import { NoTaskState } from "./NoTaskState";

const SMOKE_GENERATION_REASON = "erector_first_week_seed";
const SMOKE_WEEK_LABEL = "Smoke Test — Week 1";

/** DOC 33 — primary task card; actions from backend allowedActions only. */
export function CurrentActionPanel({
  uiState,
  order,
  stateVersion,
  onStart,
  starting,
  onRefresh,
}: {
  uiState: DashboardUiState;
  order?: OrderSummary | null;
  stateVersion?: number;
  onStart?: () => void;
  starting?: boolean;
  onRefresh?: () => void;
}) {
  if (uiState === "PENDING_SYNC") {
    return null;
  }

  if (uiState === "LOCKED") {
    return null;
  }

  if (!order?.orderId) {
    return <NoTaskState onRefresh={() => onRefresh?.()} />;
  }

  const minutes = order.timeEstimate ?? order.timeEstimateMinutes;
  const allowed =
    order.allowedActions.length > 0
      ? order.allowedActions
      : uiState === "AWAITING_FEEDBACK"
        ? ["submit_feedback", "view_details"]
        : uiState === "IN_PROGRESS"
          ? ["continue", "submit_feedback", "view_details"]
          : ["start", "view_details"];

  return (
    <section className="rounded-2xl border border-[#ECECF4] bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-[#F3F4F6] bg-gradient-to-r from-[#FAFAFC] to-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
          {LANGUAGE.dashboard.currentTaskTitle}
        </p>
        <h2 className="text-xl font-bold text-[#0F172A] mt-1">{order.title}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569] capitalize">
            {order.difficulty}
          </span>
          {minutes != null ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569]">
              ~{minutes} min
            </span>
          ) : null}
          {order.proofRequired ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200">
              Evidence required
            </span>
          ) : null}
          {order.generationReason === SMOKE_GENERATION_REASON ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 ring-1 ring-violet-200">
              {SMOKE_WEEK_LABEL}
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <p className="text-sm text-[#475569] leading-relaxed">{order.instruction}</p>
        {order.priorityReason ? (
          <p className="text-xs text-[#64748B]">
            <span className="font-semibold text-[#0F172A]">Why now: </span>
            {order.priorityReason}
          </p>
        ) : null}
        <ActionButtons
          allowed={allowed}
          orderId={order.orderId}
          onStart={onStart}
          starting={starting}
          onRefresh={onRefresh}
        />
        {stateVersion != null ? (
          <p className="sr-only">State version {stateVersion}</p>
        ) : null}
      </div>
    </section>
  );
}
