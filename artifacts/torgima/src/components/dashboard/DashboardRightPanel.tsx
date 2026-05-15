import type { DashboardProjection } from "@/lib/dashboard-types";
import { ConditionPanel, SignalSummaryPanel } from "./DashboardPanels";

/** Right rail — condition + signal summary (dashboard only). */
export function DashboardRightPanel({ state }: { state: DashboardProjection }) {
  return (
    <aside className="hidden xl:flex flex-col w-72 shrink-0 gap-4 border-l border-gray-200 bg-gray-50/80 p-5 overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Live state</p>
      <ConditionPanel state={state} />
      <SignalSummaryPanel state={state} />
      <p className="text-[10px] text-gray-400 leading-relaxed">
        State version {state.stateVersion ?? 0} · refreshed from server every few seconds.
      </p>
    </aside>
  );
}
