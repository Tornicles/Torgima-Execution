import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Play,
  Shield,
} from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { cards, buttons, PageLoading, PageError } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

function isDone(status: string) {
  return ["completed", "done", "finished"].includes(status.toLowerCase());
}

const TAG_COLORS: Record<string, string> = {
  launch: "bg-emerald-50 text-emerald-700",
  mobile: "bg-blue-50 text-blue-700",
  content: "bg-purple-50 text-purple-700",
  community: "bg-orange-50 text-orange-700",
  execution: "bg-gray-100 text-gray-700",
};

export function OrdersDashboardView() {
  const [, setLocation] = useLocation();
  const { orders, journeyDay, conditionLabel, completionRate, isLoading, isError, refetch } =
    useDashboardMetrics();

  const completed = orders.filter((o) => isDone(o.status)).length;
  const total = orders.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const activeIdx = orders.findIndex((o) => !isDone(o.status));

  if (isLoading) return <PageLoading />;
  if (isError) return <PageError message="Could not load orders." onRetry={() => void refetch()} />;

  const timelineLabels = ["Morning", "Afternoon", "Evening"];

  return (
    <DashboardPageLayout
      title="Orders"
      subtitle="Execute today's reality."
      headerRight={
        <span className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600">
          Day {journeyDay}
        </span>
      }
      stats={
        <MetricStatRow>
          <MetricStatCard label="Today" value={`Day ${journeyDay}`} sub="of your journey" icon={<Calendar className="w-5 h-5 text-gray-400" />} />
          <MetricStatCard
            label="Orders Completed"
            value={`${completed} / ${total || "—"}`}
            sub={`${pct}%`}
            valueClassName="text-emerald-600"
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
          />
          <MetricStatCard
            label="Current Condition"
            value={conditionLabel}
            sub="Productive state"
            valueClassName="text-emerald-600"
            icon={<Shield className="w-5 h-5 text-emerald-500" />}
          />
        </MetricStatRow>
      }
      rightRail={
        <>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Next Order</p>
            {orders[activeIdx] ? (
              <>
                <p className="font-semibold text-gray-900">{orders[activeIdx].title}</p>
                <button
                  type="button"
                  onClick={() => setLocation(`/tasks/${orders[activeIdx].id}`)}
                  className={`mt-3 w-full ${buttons.primary} flex items-center justify-center gap-2`}
                >
                  <Play className="w-4 h-4" /> Start
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">All orders complete for today.</p>
            )}
          </div>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Condition Guidance</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="font-semibold text-blue-700">Allowed</p>
                <p className="text-gray-600 mt-1">Focus work</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-700">Recommended</p>
                <p className="text-gray-600 mt-1">High value tasks</p>
              </div>
              <div>
                <p className="font-semibold text-red-700">Restricted</p>
                <p className="text-gray-600 mt-1">Low impact work</p>
              </div>
            </div>
          </div>
        </>
      }
      footer={
        <StickyFooter
          message="Complete orders with proof. Feedback keeps the system aligned with your reality."
          action={
            <button type="button" onClick={() => setLocation("/feedback")} className={buttons.primary}>
              Submit Feedback →
            </button>
          }
        />
      }
    >
      <div className={cards.padded}>
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-bold uppercase text-gray-500">Today&apos;s Orders</p>
          <span className="text-sm text-gray-600">Progress {pct}%</span>
        </div>
        <ProgressBar value={pct} className="mb-6" />
        <ol className="space-y-3">
          {orders.length === 0 ? (
            <li className="text-sm text-gray-500 py-6 text-center">No orders for today.</li>
          ) : (
            orders.map((order, idx) => {
              const done = isDone(order.status);
              const expanded = idx === activeIdx;
              const tag = TAG_COLORS[order.type?.toLowerCase() ?? ""] ?? TAG_COLORS.execution;
              return (
                <li
                  key={order.id}
                  className={`rounded-xl border p-4 ${expanded ? "border-blue-300 bg-blue-50/30" : "border-gray-100"}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        done ? "bg-emerald-500 text-white" : "border border-gray-300 text-gray-500"
                      }`}
                    >
                      {done ? "✓" : idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${done ? "text-emerald-700 line-through" : "text-gray-900"}`}>
                        {order.title}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tag}`}>
                          {order.type}
                        </span>
                        {order.estimatedMinutes != null && (
                          <span className="text-xs text-gray-400">{order.estimatedMinutes}m</span>
                        )}
                      </div>
                      {expanded && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setLocation(`/tasks/${order.id}`)}
                            className="inline-flex items-center gap-1 bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                          >
                            <Play className="w-4 h-4" /> Start
                          </button>
                          <Link href={`/feedback/${order.id}`}>
                            <span className="inline-block border border-gray-200 bg-white text-sm font-semibold px-4 py-2 rounded-lg cursor-pointer">
                              Complete
                            </span>
                          </Link>
                        </div>
                      )}
                    </div>
                    {!expanded && <ChevronRight className="w-4 h-4 text-gray-300" />}
                    {expanded && <ChevronDown className="w-4 h-4 text-blue-500" />}
                  </div>
                </li>
              );
            })
          )}
        </ol>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Execution Timeline</p>
        <div className="flex justify-between items-center gap-2">
          {timelineLabels.map((label, i) => (
            <div key={label} className="flex-1 text-center">
              <div
                className={`mx-auto w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs ${
                  i < completed ? "bg-emerald-500 border-emerald-500 text-white"
                  : i === activeIdx ? "border-blue-500 text-blue-600"
                  : "border-gray-200 text-gray-400"
                }`}
              >
                {i < completed ? "✓" : i + 1}
              </div>
              <p className="text-[10px] text-gray-400 mt-2 uppercase">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardPageLayout>
  );
}
