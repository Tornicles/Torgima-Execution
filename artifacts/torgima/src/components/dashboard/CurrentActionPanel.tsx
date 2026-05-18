import { Link } from "wouter";
import { Play, MessageSquare, AlertTriangle, Lock } from "lucide-react";
import type { DashboardUiState } from "@/lib/dashboard-types";

export function CurrentActionPanel({
  uiState,
  action,
  onStart,
  starting,
}: {
  uiState: DashboardUiState;
  action?: Record<string, unknown> | null;
  onStart?: () => void;
  starting?: boolean;
}) {
  const orderId = action?.orderId ?? action?.id;
  const title = String(action?.title ?? "Next execution order");
  const instruction = String(action?.instruction ?? "");
  const difficulty = String(action?.difficulty ?? "moderate");
  const minutes = action?.timeEstimateMinutes as number | undefined;
  const proofRequired = Boolean(action?.proofRequired);

  if (uiState === "PENDING_SYNC") {
    return (
      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <h2 className="font-bold text-sky-950">Assembling your next order</h2>
        </div>
        <p className="text-sm text-sky-800">
          The execution loop is generating your next valid Order. This usually completes within a few seconds.
        </p>
      </section>
    );
  }

  if (uiState === "LOCKED") {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-red-800">
          <Lock className="w-5 h-5" />
          <h2 className="font-bold">Execution locked</h2>
        </div>
        <p className="text-sm text-red-700">
          Critical system safeguards are active. Follow the recovery path before attempting new execution orders.
        </p>
        <Link href="/recovery">
          <span className="text-sm font-semibold text-red-800 underline cursor-pointer">Open recovery →</span>
        </Link>
      </section>
    );
  }

  if (uiState === "AWAITING_FEEDBACK") {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6 space-y-3">
        <div className="flex items-center gap-2 text-violet-900">
          <MessageSquare className="w-5 h-5" />
          <h2 className="font-bold">Feedback required</h2>
        </div>
        <p className="text-sm text-violet-800">
          An execution Order is waiting for your report. Submit feedback to continue the loop and receive your next Order.
        </p>
        <Link href="/orders">
          <span className="inline-flex items-center gap-2 bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer hover:bg-violet-800">
            Submit execution report
          </span>
        </Link>
      </section>
    );
  }

  if (!action || !orderId) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">No current execution order. The system will publish one shortly.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current action</p>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{title}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 capitalize">{difficulty}</span>
          {minutes != null && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">~{minutes} min</span>
          )}
          {proofRequired && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-amber-200">
              Proof required
            </span>
          )}
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{instruction}</p>
        <div className="flex flex-wrap gap-3">
          {uiState === "READY" && (
            <button
              type="button"
              disabled={starting}
              onClick={onStart}
              className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {starting ? "Starting…" : "Start execution"}
            </button>
          )}
          {uiState === "IN_PROGRESS" && (
            <Link href={`/tasks/${orderId}`}>
              <span className="inline-flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl cursor-pointer hover:bg-green-700">
                Continue execution
              </span>
            </Link>
          )}
          {(uiState === "RECOVERY" || uiState === "BLOCKED") && (
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Complete this order to restore loop continuity.</span>
            </div>
          )}
          <Link href={`/tasks/${orderId}`}>
            <span className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 cursor-pointer">
              View full order →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
