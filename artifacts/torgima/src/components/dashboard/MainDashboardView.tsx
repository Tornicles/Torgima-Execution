import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import type { DashboardProjection } from "@/lib/dashboard-types";
import type { Order } from "@workspace/api-client-react";
import { StatCard } from "@/components/design-system/StatCard";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { TrendChart } from "@/components/design-system/TrendChart";
import { getSignalHistory } from "@/lib/torgima-api";

const TAG_COLORS: Record<string, string> = {
  default: "bg-gray-100 text-gray-700",
  launch: "bg-emerald-50 text-emerald-700",
  mobile: "bg-blue-50 text-blue-700",
  content: "bg-purple-50 text-purple-700",
  community: "bg-orange-50 text-orange-700",
};

function orderTag(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("launch") || t.includes("erector")) return TAG_COLORS.launch;
  if (t.includes("mobile")) return TAG_COLORS.mobile;
  if (t.includes("content")) return TAG_COLORS.content;
  if (t.includes("community")) return TAG_COLORS.community;
  return TAG_COLORS.default;
}

function isCompleted(status: string): boolean {
  return status === "completed" || status === "done" || status === "finished";
}

export function MainDashboardView({ state }: { state: DashboardProjection }) {
  const [, setLocation] = useLocation();
  const [trendPoints, setTrendPoints] = useState<number[]>([]);

  const displayName =
    state.user?.displayName ?? state.user?.email?.split("@")[0] ?? "Builder";
  const blueprint = state.activeBlueprint;
  const signals = state.signals;
  const signalExtra = (state.signalProjection ?? {}) as Record<string, unknown>;
  const conditionRaw = (
    (state.conditionDetail as { condition?: string } | undefined)?.condition ??
    blueprint?.currentCondition ??
    signals?.condition ??
    "stability"
  ).toString();
  const conditionLabel = conditionRaw.replace(/_/g, " ").toUpperCase();

  const rawCompletion = Number(signalExtra.completionRate ?? signals?.consistency ?? 0);
  const completionRate = Math.round(rawCompletion <= 1 ? rawCompletion * 100 : rawCompletion);
  const momentum = signals?.momentum ?? 0;
  const rawScore = Number(signalExtra.weightedScore ?? signals?.velocity ?? signals?.consistency ?? 0);
  const dailyScore = Number((rawScore <= 1 ? rawScore * 10 : rawScore).toFixed(1));
  const streak = state.streakDays ?? signals?.streak ?? 0;

  const orders = (state.activeOrders ?? []) as Order[];
  const completedCount = orders.filter((o) => isCompleted(o.status)).length;
  const totalOrders = Math.max(orders.length, completedCount, 1);
  const ordersPct = Math.round((completedCount / totalOrders) * 100);

  const journeyDay = useMemo(() => {
    if (!blueprint?.activatedAt) return blueprint?.phase ?? 1;
    const start = new Date(blueprint.activatedAt).getTime();
    const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  }, [blueprint]);

  const phaseLabel = blueprint ? `Phase ${blueprint.phase}${blueprint.totalPhases ? ` of ${blueprint.totalPhases}` : ""}` : "—";
  const overallProgress = Math.min(
    100,
    Math.round(((blueprint?.phase ?? 1) / (blueprint?.totalPhases ?? 4)) * 100) || 26,
  );

  useEffect(() => {
    void getSignalHistory()
      .then((hist) => {
        const snaps =
          (hist as { snapshots?: Array<{ completionRate?: number; weightedScore?: number }> })?.snapshots ??
          (Array.isArray(hist) ? hist : []);
        const pts = snaps.slice(-7).map((s) => {
          const row = s as { completionRate?: number; weightedScore?: number };
          const cr = row.completionRate ?? 0;
          return cr <= 1 ? cr * 100 : cr;
        });
        setTrendPoints(pts.length ? pts : [completionRate]);
      })
      .catch(() => setTrendPoints([completionRate]));
  }, [completionRate]);

  const trendLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].slice(-trendPoints.length);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 bg-[#f9fafb] min-h-full">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {displayName}.
          </h1>
          <p className="text-sm text-gray-500 mt-1">Day {journeyDay} of your execution journey.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Condition"
          value={conditionLabel}
          sub="You're in a productive state."
          accentClass="text-emerald-600"
          icon={<Shield className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          label="Day"
          value={String(journeyDay)}
          sub="of your journey."
          accentClass="text-gray-900"
          icon={<Calendar className="w-5 h-5 text-gray-400" />}
        />
        <StatCard
          label="Week Rate"
          value={`${completionRate}%`}
          sub={<span className="text-emerald-600">↑ vs last week</span>}
          accentClass="text-emerald-600"
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          label="Momentum"
          value={`${momentum >= 0 ? "+" : ""}${momentum}%`}
          sub={<span className="text-emerald-600">↑ Improving</span>}
          accentClass="text-emerald-600"
          icon={<Target className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Today&apos;s Orders</h2>
            <Link href="/orders" className="text-sm text-emerald-600 font-medium hover:underline">
              View All Orders →
            </Link>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-gray-900">
                {completedCount} / {orders.length || totalOrders} completed
              </span>
              <span className="text-gray-500">{ordersPct}%</span>
            </div>
            <ProgressBar value={ordersPct} />
          </div>
          <ul className="divide-y divide-gray-100">
            {orders.length === 0 ? (
              <li className="py-6 text-center text-sm text-gray-500">No orders scheduled for today.</li>
            ) : (
              orders.slice(0, 8).map((order) => {
                const done = isCompleted(order.status);
                return (
                  <li key={order.id} className="flex items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => setLocation(done ? `/feedback/${order.id}` : `/tasks/${order.id}`)}
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300"
                      }`}
                      aria-label={done ? "Submit feedback" : "Open order"}
                    >
                      {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${done ? "text-emerald-700 line-through" : "text-gray-900"}`}>
                        {order.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${orderTag(order.type)}`}>
                          {blueprint?.title ?? order.type}
                        </span>
                        {order.estimatedMinutes != null && (
                          <span className="text-xs text-gray-400">{order.estimatedMinutes}m</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">
            Submit feedback for completed tasks. Help the system adjust to your reality.
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Current Condition</p>
            <Shield className="w-10 h-10 text-emerald-500 mb-2" />
            <p className="text-lg font-bold text-emerald-600 uppercase">{conditionLabel}</p>
            <p className="text-sm text-gray-500 mt-1">You&apos;re in a productive state. Maintain consistency.</p>
            <button
              type="button"
              onClick={() => setLocation("/signals")}
              className="mt-4 text-sm text-gray-600 hover:text-emerald-600 flex items-center gap-1"
            >
              View Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500">Key Metrics</p>
            {[
              { label: "Completion Rate", value: `${completionRate}%`, color: "text-emerald-600" },
              { label: "Daily Score", value: `${dailyScore}/10`, color: "text-gray-900" },
              { label: "Momentum", value: `${momentum >= 0 ? "+" : ""}${momentum}%`, color: "text-emerald-600" },
              { label: "Current Streak", value: `${streak} days`, color: "text-orange-500" },
            ].map((m) => (
              <div key={m.label} className="flex justify-between text-sm">
                <span className="text-gray-600">{m.label}</span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLocation("/signals")}
              className="text-sm text-emerald-600 font-medium pt-1"
            >
              View Signals →
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">7-Day Trend</h2>
            <button type="button" onClick={() => setLocation("/signals")} className="text-sm text-emerald-600 font-medium">
              View Full Signals →
            </button>
          </div>
          <TrendChart points={trendPoints} labels={trendLabels} />
          <p className="text-sm text-emerald-700 mt-4 font-medium">
            You&apos;re trending in the right direction. Keep building.
          </p>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">Next Up</p>
            <p className="text-sm font-semibold text-gray-900 mt-2">
              Tomorrow: {Math.max(1, orders.length - completedCount)} tasks scheduled
            </p>
            <p className="text-xs text-gray-500 mt-1">Focus: Complete high-impact tasks.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-2">
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">Quick Actions</p>
            {[
              { label: "View Orders", href: "/orders", icon: ClipboardList },
              { label: "Submit Feedback", href: "/feedback", icon: MessageSquare },
              { label: "Strategy Review", href: "/strategy", icon: ArrowUpRight },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
                  <a.icon className="w-4 h-4 text-gray-400" />
                  {a.label}
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Blueprint</h2>
          <Link href="/blueprint" className="text-sm text-emerald-600 font-medium">
            View Blueprint →
          </Link>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-900">{blueprint?.title ?? "Blueprint"}</h3>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            Active
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-2">Overall Progress</p>
        <ProgressBar value={overallProgress} />
        <p className="text-right text-sm font-semibold text-emerald-600 mt-1">{overallProgress}%</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Current Plan</p>
            <p className="font-semibold text-gray-900 mt-0.5">{blueprint?.domain ?? "MVP Foundation"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Current Phase</p>
            <p className="font-semibold text-gray-900 mt-0.5">{phaseLabel}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Projects</p>
            <p className="font-semibold text-gray-900 mt-0.5">
              {completedCount}/{orders.length || "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Journey</p>
            <p className="font-semibold text-gray-900 mt-0.5">Day {journeyDay}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
