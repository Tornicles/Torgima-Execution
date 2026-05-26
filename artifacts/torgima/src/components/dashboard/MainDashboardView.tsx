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
  Star,
  Target,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { BhudhiSection } from "@/components/bhudhi/BhudhiSection";
import { fetchBhudhiStatus, type BhudhiStatusPayload } from "@/lib/bhudhi-api";
import { getDashboardUiState } from "@/lib/dashboard-types";
import type { DashboardProjection } from "@/lib/dashboard-types";
import type { Order } from "@workspace/api-client-react";
import { StatCard } from "@/components/design-system/StatCard";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { TrendChart } from "@/components/design-system/TrendChart";
import { PageHeaderActions } from "@/components/design-system/PageHeaderActions";
import { getSignalHistory } from "@/lib/torgima-api";
import { buttons } from "@/design";
import { SequenceProgressPanel } from "@/components/sequence/SequenceProgressPanel";
import { SystemUpgradeNotice } from "@/components/sequence/SystemUpgradeNotice";
import { useTierSequenceStatus } from "@/hooks/useTierSequenceStatus";

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
  const [bhudhiOpen, setBhudhiOpen] = useState(false);
  const [bhudhiStatus, setBhudhiStatus] = useState<BhudhiStatusPayload | null>(null);
  const uiState = getDashboardUiState(state);
  const displayName = state.user?.displayName ?? state.user?.email?.split("@")[0] ?? "Builder";
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
  const pendingOrders = orders.filter((o) => !isCompleted(o.status));
  const completedOrders = orders.filter((o) => isCompleted(o.status));
  const displayOrders = [...pendingOrders, ...completedOrders].slice(0, 6);
  const completedCount = completedOrders.length;
  const totalOrders = orders.length;
  const ordersPct = totalOrders ? Math.round((completedCount / totalOrders) * 100) : 0;

  const journeyDay = useMemo(() => {
    if (!blueprint?.activatedAt) return blueprint?.phase ?? 1;
    const start = new Date(blueprint.activatedAt).getTime();
    return Math.max(1, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)) + 1);
  }, [blueprint]);

  const phaseLabel = blueprint
    ? `Phase ${blueprint.phase}${blueprint.totalPhases ? ` of ${blueprint.totalPhases}` : ""}`
    : "—";
  const overallProgress = Math.min(
    100,
    Math.round(((blueprint?.phase ?? 1) / (blueprint?.totalPhases ?? 4)) * 100),
  );

  useEffect(() => {
    void getSignalHistory()
      .then((hist) => {
        const snaps =
          (hist as { snapshots?: Array<{ completionRate?: number }> })?.snapshots ??
          (Array.isArray(hist) ? hist : []);
        const pts = snaps.slice(-7).map((s) => {
          const cr = (s as { completionRate?: number }).completionRate ?? 0;
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

  const blueprintHref = blueprint?.id ? `/blueprint/${blueprint.id}` : "/blueprint";
  const bhudhiHref = blueprint?.id ? `/app/bhudhi?blueprintId=${blueprint.id}` : "/app/bhudhi";

  useEffect(() => {
    if (!bhudhiOpen || !blueprint?.id) return;
    void fetchBhudhiStatus(blueprint.id).then(setBhudhiStatus);
  }, [bhudhiOpen, blueprint?.id]);

  if (uiState === "NO_BLUEPRINT") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Target className="w-12 h-12 text-[var(--torgima-primary)] mb-4" />
        <h2 className="text-xl font-bold text-gray-900">Start your execution journey.</h2>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Validate your goal to create your blueprint and receive today&apos;s orders.
        </p>
        <button type="button" onClick={() => setLocation("/validate")} className={`mt-6 ${buttons.primary}`}>
          Get Started →
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 min-h-full">
      <header className="flex items-start justify-between gap-4 flex-wrap border-b border-gray-100 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {displayName}.
          </h1>
          <p className="text-sm text-gray-500 mt-1">Day {journeyDay} of your execution journey.</p>
        </div>
        <PageHeaderActions />
      </header>

      <SystemUpgradeNotice />

      {blueprint?.id && (
        <SequenceProgressPanel status={tierStatus} loading={tierStatusLoading} />
      )}

      {blueprint?.id && (
        <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[var(--torgima-primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Bhudhi intelligence</p>
              <p className="text-xs text-gray-500 mt-0.5 max-w-md">
                Systems, engines, frameworks, signals, and recommendations for this blueprint.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttons.secondary} onClick={() => setBhudhiOpen(true)}>
              Quick view
            </button>
            <Link href={bhudhiHref}>
              <span className={buttons.primary}>Open Bhudhi</span>
            </Link>
          </div>
        </div>
      )}

      {blueprint?.id && (
        <BhudhiSection
          blueprintId={blueprint.id}
          isOpen={bhudhiOpen}
          onClose={() => setBhudhiOpen(false)}
          status={bhudhiStatus}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Condition"
          value={conditionLabel}
          sub="You're in a productive state."
          accentClass="text-[var(--torgima-primary)]"
          icon={<Shield className="w-5 h-5 text-[var(--torgima-primary)]" />}
        />
        <StatCard
          label="Day"
          value={String(journeyDay)}
          sub="of your journey"
          accentClass="text-gray-900"
          icon={<Calendar className="w-5 h-5 text-gray-400" />}
        />
        <StatCard
          label="Week Rate"
          value={`${completionRate}%`}
          sub={<span className="text-[var(--torgima-primary)]">+ vs last week</span>}
          accentClass="text-[var(--torgima-primary)]"
          icon={<TrendingUp className="w-5 h-5 text-[var(--torgima-primary)]" />}
        />
        <StatCard
          label="Momentum"
          value={`${momentum >= 0 ? "+" : ""}${momentum}%`}
          sub={<span className="text-[var(--torgima-primary)]">{momentum >= 0 ? "Improving" : "Declining"}</span>}
          accentClass="text-[var(--torgima-primary)]"
          icon={<ArrowUpRight className="w-5 h-5 text-[var(--torgima-primary)]" />}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Today&apos;s Orders</h2>
            <Link href="/orders" className="text-sm text-[var(--torgima-primary)] font-medium hover:underline">
              View All Orders →
            </Link>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-gray-900">
              {completedCount} / {totalOrders || "—"} completed
            </span>
            <span className="text-gray-500">{ordersPct}%</span>
          </div>
          <ProgressBar value={ordersPct} className="mb-4" />
          <ul className="divide-y divide-gray-100">
            {displayOrders.length === 0 ? (
              <li className="py-8 text-center text-sm text-gray-500">
                No orders for today. Orders will appear once your blueprint is active.
              </li>
            ) : (
              displayOrders.map((order) => {
                const done = isCompleted(order.status);
                return (
                  <li key={order.id} className="flex items-center gap-3 py-3 group">
                    <span
                      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                        done ? "bg-[var(--torgima-primary)] border-[var(--torgima-primary)] text-white" : "border-gray-300"
                      }`}
                    >
                      {done && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>
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
                    <button
                      type="button"
                      onClick={() => setLocation(done ? `/feedback/${order.id}` : `/tasks/${order.id}`)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500"
                      aria-label="Open order"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {completedCount > 0 && (
            <Link href="/feedback">
              <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-[var(--torgima-primary-light)] border border-green-100 px-4 py-3 cursor-pointer hover:bg-green-50">
                <p className="text-sm text-gray-700">
                  Submit feedback for completed tasks. Help the system adjust to your reality.
                </p>
                <ChevronRight className="w-4 h-4 text-[var(--torgima-primary)] shrink-0" />
              </div>
            </Link>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Current Condition</p>
            <Shield className="w-10 h-10 text-[var(--torgima-primary)] mb-2" />
            <p className="text-xl font-bold text-[var(--torgima-primary)] uppercase">{conditionLabel}</p>
            <p className="text-sm text-gray-500 mt-1">You&apos;re in a productive state. Maintain consistency.</p>
            <button
              type="button"
              onClick={() => setLocation("/signals")}
              className="mt-3 text-sm text-gray-600 hover:text-[var(--torgima-primary)] flex items-center gap-1"
            >
              View Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500">Key Metrics</p>
            {[
              { label: "Completion Rate", value: `${completionRate}%`, icon: CheckCircle2, color: "text-[var(--torgima-primary)]" },
              { label: "Daily Score", value: `${dailyScore}/10`, icon: Star, color: "text-gray-900" },
              { label: "Momentum", value: `${momentum >= 0 ? "+" : ""}${momentum}%`, icon: TrendingUp, color: "text-[var(--torgima-primary)]" },
              { label: "Current Streak", value: `${streak} days`, icon: Target, color: "text-orange-500" },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <m.icon className="w-4 h-4 text-gray-400" />
                  {m.label}
                </span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLocation("/signals")}
              className="text-sm text-[var(--torgima-primary)] font-medium"
            >
              View Signals →
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase text-gray-500">7-Day Trend</p>
              <button
                type="button"
                onClick={() => setLocation("/signals")}
                className="text-xs text-[var(--torgima-primary)] font-medium"
              >
                View Full Signals →
              </button>
            </div>
            <TrendChart points={trendPoints} labels={trendLabels} height={100} />
            <p className="text-sm text-gray-700 mt-3 font-medium">
              You&apos;re trending in the right direction. Keep building.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Blueprint</h2>
            <Link href={blueprintHref} className="text-sm text-[var(--torgima-primary)] font-medium">
              View Blueprint →
            </Link>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-lg font-bold text-gray-900">{blueprint?.title ?? "Blueprint"}</h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--torgima-primary-light)] text-[var(--torgima-primary)]">
              Active
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Overall Progress</p>
          <ProgressBar value={overallProgress} />
          <p className="text-right text-sm font-semibold text-[var(--torgima-primary)] mt-1">{overallProgress}%</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Current Plan</p>
              <p className="font-semibold text-gray-900 mt-0.5">{blueprint?.domain ?? "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Current Phase</p>
              <p className="font-semibold text-gray-900 mt-0.5">{phaseLabel}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Projects</p>
              <p className="font-semibold text-gray-900 mt-0.5">
                {completedCount} / {totalOrders > 0 ? totalOrders : "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Journey</p>
              <p className="font-semibold text-gray-900 mt-0.5">Day {journeyDay}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Next Up</p>
            <div className="flex items-start gap-2 mb-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Tomorrow: {Math.max(0, pendingOrders.length)} tasks scheduled
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-gray-400 mt-0.5" />
              <Link href="/orders" className="text-sm text-gray-700 hover:text-[var(--torgima-primary)]">
                Focus: Complete high-impact tasks
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-1">
            <p className="text-xs font-bold uppercase text-gray-500 mb-2">Quick Actions</p>
            {[
              { label: "View Orders", href: "/orders", icon: ClipboardList },
              { label: "Submit Feedback", href: "/feedback", icon: MessageSquare },
              { label: "Strategy Review", href: "/strategy", icon: ArrowUpRight },
            ].map((a) => (
              <Link key={a.href} href={a.href}>
                <div className="flex items-center gap-2 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
                  <a.icon className="w-4 h-4 text-gray-400" />
                  {a.label}
                  <ChevronRight className="w-4 h-4 ml-auto text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
