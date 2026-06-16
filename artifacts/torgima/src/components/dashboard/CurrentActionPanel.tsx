import type { DashboardUiState } from "@/lib/dashboard-types";
import { LANGUAGE } from "@/lib/language";
import type { OrderSummary } from "@/types/dashboard";
import { ActionButtons } from "./ActionButtons";
import { NoTaskState } from "./NoTaskState";

const SMOKE_GENERATION_REASON = "erector_first_week_seed";
const SMOKE_WEEK_LABEL = "Smoke Test — Week 1";

function difficultyLabel(difficulty: string): string {
  const key = difficulty.toLowerCase().replace(/\s+/g, "_") as keyof typeof LANGUAGE.task.difficulty;
  return LANGUAGE.task.difficulty[key] ?? difficulty;
}

/** DOC 33 — primary task card; actions from backend allowedActions only. */
export function CurrentActionPanel({
  uiState,
  order,
  stateVersion,
  onStart,
  starting,
  onRefresh,
  mutationsDisabled,
  recoveryMode,
}: {
  uiState: DashboardUiState;
  order?: OrderSummary | null;
  stateVersion?: number;
  onStart?: () => void;
  starting?: boolean;
  onRefresh?: () => void;
  mutationsDisabled?: boolean;
  recoveryMode?: boolean;
}) {
  if (uiState === "PENDING_SYNC" || uiState === "AWAITING_FEEDBACK") {
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
      : uiState === "IN_PROGRESS"
        ? ["continue", "submit_feedback", "view_details"]
        : ["start", "view_details"];

  const shellClass = recoveryMode
    ? "border-sky-200 bg-sky-50/40"
    : "border-[#ECECF4] bg-white";

  return (
    <section className={`rounded-2xl border overflow-hidden shadow-sm ${shellClass}`}>
      <div className="px-6 py-4 border-b border-[#F3F4F6] bg-gradient-to-r from-[#FAFAFC] to-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
          {LANGUAGE.dashboard.currentTaskTitle}
        </p>
        <h2 className="text-xl font-bold text-[#0F172A] mt-1 line-clamp-1">{order.title}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569]">
            {difficultyLabel(order.difficulty)}
          </span>
          {minutes != null ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#475569]">
              ~{minutes} min
            </span>
          ) : null}
          {order.proofRequired ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200">
              {order.proofType ? `Evidence: ${order.proofType}` : "Evidence required"}
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
        {order.whyItMatters ? (
          <p className="text-sm text-[#475569] leading-relaxed">
            <span className="font-semibold text-[#0F172A]">Why it matters: </span>
            {order.whyItMatters}
          </p>
        ) : null}
        <p className="text-sm text-[#475569] leading-relaxed">{order.instruction}</p>
        {order.expectedOutput ? (
          <p className="text-sm text-[#64748B]">
            <span className="font-semibold text-[#0F172A]">Expected output: </span>
            {order.expectedOutput}
          </p>
        ) : null}
        {order.definitionOfDone ? (
          <p className="text-sm text-[#64748B]">
            <span className="font-semibold text-[#0F172A]">Done when: </span>
            {order.definitionOfDone}
          </p>
        ) : null}
        <ActionButtons
          allowed={allowed}
          orderId={order.orderId}
          onStart={onStart}
          starting={starting || mutationsDisabled}
          onRefresh={onRefresh}
          disabled={mutationsDisabled}
        />
        {stateVersion != null ? (
          <p className="sr-only">State version {stateVersion}</p>
        ) : null}
      </div>
    </section>
  );
}
