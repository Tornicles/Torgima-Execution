import { Link } from "wouter";
import { Calendar, TrendingUp, Zap, ChevronRight, CheckCircle2, Circle, MessageSquare } from "lucide-react";
import { useDashboardProjection } from "@/hooks/useDashboardProjection";
type DashboardState = Record<string, any>;
type Order = Record<string, any>;

function getHourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const CONDITION_CONFIG: Record<string, { color: string; bg: string; icon: string; message: string }> = {
  stability: { color: "text-green-600", bg: "bg-green-50", icon: "🛡️", message: "Execution chain stable — maintain continuity." },
  power: { color: "text-blue-600", bg: "bg-blue-50", icon: "⚡", message: "Elevated execution state — scale disciplined output." },
  affluence: {
    color: "text-purple-600",
    bg: "bg-purple-50",
    icon: "👑",
    message: "Maximum execution capacity window — prioritize high-leverage execution orders.",
  },
  urgency: {
    color: "text-orange-600",
    bg: "bg-orange-50",
    icon: "🔥",
    message: "Execution continuity needs reinforcement — stabilize momentum.",
  },
  danger: {
    color: "text-red-600",
    bg: "bg-red-50",
    icon: "⚠️",
    message: "Recovery stance — shorten loop; protect signal quality.",
  },
  nothingness: {
    color: "text-gray-600",
    bg: "bg-gray-50",
    icon: "○",
    message: "Baseline initializing — complete your first execution order.",
  },
  power_change: {
    color: "text-amber-600",
    bg: "bg-amber-50",
    icon: "↗️",
    message: "Condition transition detected — adaptation active.",
  },
};

function blueprintExtras(blueprint: NonNullable<DashboardState["activeBlueprint"]>) {
  const totalPhases = blueprint.totalPhases ?? 4;
  const phase = blueprint.phase ?? 1;
  const progressPercent = Math.min(100, Math.round((phase / Math.max(totalPhases, 1)) * 100));
  const raw = blueprint.rawGoal?.trim();
  const currentPlan = raw && raw.length > 48 ? `${raw.slice(0, 48)}…` : raw || blueprint.title;
  return {
    progressPercent,
    currentPlan,
    currentPhase: `Phase ${phase} of ${totalPhases}`,
  };
}

export default function Dashboard() {
  const { data: state, isLoading } = useDashboardProjection();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-lg w-72" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500 text-sm">Cannot connect to execution server.</p>
        <div className="flex gap-4 text-xs">
          <button type="button" onClick={() => window.location.reload()} className="text-green-600 underline">
            Refresh
          </button>
          <a href="/login" className="text-green-600 underline">
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  const displayName =
    state.user?.displayName ?? state.user?.email?.split("@")[0] ?? "Builder";
  const detail = state.conditionDetail as { condition?: string } | undefined;
  const conditionKey = (
    detail?.condition ??
    state.signals?.condition ??
    "nothingness"
  ).toLowerCase();
  const conditionCfg = CONDITION_CONFIG[conditionKey] ?? CONDITION_CONFIG.nothingness;
  const weekRate = Math.round(state.signals?.consistency ?? 0);
  const momentum = state.signals?.momentum ?? 0;
  const blueprint = state.activeBlueprint;
  const dayNumber = blueprint
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(blueprint.activatedAt ?? blueprint.createdAt).getTime()) / 86400000,
        ),
      )
    : 0;
  const todayCompleted = state.tasksCompletedToday ?? 0;
  const orders: Order[] = state.activeOrders ?? [];
  const signals = state.signals;
  const orderDone = (o: Order) =>
    o.status === "complete" || (o.status as string) === "completed";

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {getHourGreeting()}, {displayName}.
          </h1>
          <p className="text-gray-500 mt-1">Day {dayNumber} of your execution journey.</p>
        </div>
      </div>

      {blueprint ? (
        <div className="bg-gray-900 text-white rounded-2xl p-4 flex items-start gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0 animate-pulse" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">System awareness</p>
            <p className="text-sm text-white leading-relaxed">
              {conditionKey === "affluence" &&
                "Execution capacity peaked. Maintain strategic continuity — scale externally verifiable output before regimes normalize."}
              {conditionKey === "power" &&
                "Execution momentum elevated. Operational intelligence: preserve cadence — each completed order compounds the signal stack."}
              {conditionKey === "stability" &&
                "Execution chain stable — blueprint position on track under current enforcement. Increase difficulty deliberately to bias toward Power."}
              {conditionKey === "urgency" &&
                "Execution continuity softening — restore rhythm: clear pending execution orders before signal quality degrades further."}
              {conditionKey === "danger" &&
                "Execution chain interrupted — recovery stance active. Single high-leverage execution order restores signal coherence."}
              {conditionKey === "nothingness" &&
                "Execution baseline initializing — first completed order establishes the signal ledger. Execute immediately."}
              {conditionKey === "power_change" &&
                "Condition transition logged — adaptation in progress across enforcement. Continue executing; operational pauses distort signal fidelity."}
            </p>
          </div>
          <a href="/signals" className="text-xs text-green-400 font-mono uppercase tracking-wider whitespace-nowrap hover:text-green-300 shrink-0">
            View signals →
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border border-gray-200 p-5 ${conditionCfg.bg}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Condition</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl shrink-0" aria-hidden>
              {conditionCfg.icon}
            </span>
            <span className={`text-xl font-bold uppercase ${conditionCfg.color}`}>
              {conditionKey.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">{conditionCfg.message}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Day</p>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-indigo-500" />
            <span className="text-3xl font-bold text-gray-900">{dayNumber}</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">of your journey</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Week Rate</p>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <span className="text-3xl font-bold text-gray-900">{weekRate}%</span>
          </div>
          <p className="text-xs text-green-600 mt-2">↑ vs last week</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Momentum</p>
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            <span className="text-3xl font-bold text-gray-900">+{momentum}%</span>
          </div>
          <p className="text-xs text-green-600 mt-2">↑ Improving</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">TODAY&apos;S ORDERS</h2>
                <p className="text-xs text-gray-500">
                  {todayCompleted} / {orders.length} completed
                </p>
              </div>
              <Link href="/orders">
                <span className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer flex items-center gap-1">
                  View All Orders <ChevronRight className="w-4 h-4" />
                </span>
              </Link>
            </div>

            <div className="px-6 pt-3 pb-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex-1 bg-gray-100 rounded-full h-2 mr-3">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${orders.length > 0 ? (todayCompleted / orders.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {orders.length > 0 ? Math.round((todayCompleted / orders.length) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {orders.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400 text-sm">
                  No active orders. System is assembling your next execution order.
                </div>
              ) : (
                orders.slice(0, 6).map((order) => {
                  const isDone = orderDone(order);
                  return (
                    <Link key={order.id} href={`/tasks/${order.id}`}>
                      <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors">
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${isDone ? "line-through text-gray-400" : "text-gray-900"}`}
                          >
                            {order.title}
                          </p>
                          {blueprint?.title && (
                            <span className="inline-block mt-0.5 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {blueprint.title}
                            </span>
                          )}
                        </div>
                        {order.estimatedMinutes != null && (
                          <span className="text-xs text-gray-400 shrink-0">{order.estimatedMinutes}m</span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>
                    </Link>
                  );
                })
              )}

              <Link href="/feedback">
                <div className="flex items-center gap-4 px-6 py-3.5 bg-green-50 hover:bg-green-100 cursor-pointer transition-colors">
                  <MessageSquare className="w-5 h-5 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800">Submit execution reports for completed orders</p>
                    <p className="text-xs text-green-600">Help the system adjust to your reality.</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-green-500" />
                </div>
              </Link>
            </div>
          </div>

          {blueprint && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">ACTIVE BLUEPRINT</h2>
                <Link href={`/blueprint/${blueprint.id}`}>
                  <span className="text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer flex items-center gap-1">
                    View Blueprint <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{blueprint.title ?? blueprint.rawGoal}</p>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    ACTIVE
                  </span>
                </div>
              </div>
              {(() => {
                const x = blueprintExtras(blueprint);
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Overall Progress</span>
                      <span className="font-semibold text-gray-900">{x.progressPercent}%</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${x.progressPercent}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div>
                        <p className="text-xs text-gray-500">Current Plan</p>
                        <p className="text-sm font-medium text-gray-900">{x.currentPlan}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Current Phase</p>
                        <p className="text-sm font-medium text-gray-900">{x.currentPhase}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Projects</p>
                        <p className="text-sm font-medium text-gray-900">—</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {!blueprint && (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
              <p className="text-gray-500 mb-3">No active blueprint</p>
              <Link href="/onboarding">
                <span className="inline-block bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl cursor-pointer hover:bg-gray-800">
                  Create Blueprint →
                </span>
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className={`rounded-2xl border border-gray-200 p-6 ${conditionCfg.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Condition</p>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <div className="text-center py-3">
              <span className="text-4xl" aria-hidden>
                {conditionCfg.icon}
              </span>
              <p className={`text-2xl font-bold mt-2 uppercase ${conditionCfg.color}`}>
                {conditionKey.replace("_", " ")}
              </p>
              <p className="text-xs text-gray-500 mt-1">{conditionCfg.message}</p>
            </div>
            <Link href="/signals">
              <div className="mt-3 flex items-center justify-center gap-1 text-sm text-green-600 hover:text-green-700 cursor-pointer font-medium">
                View Details <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Key Metrics</h3>
            <div className="space-y-3">
              {[
                { label: "Completion Rate", value: `${weekRate}%`, color: "text-green-600" },
                { label: "Daily Score", value: `${(signals?.velocity ?? 0).toFixed(1)} / 10`, color: "text-gray-900" },
                { label: "Momentum", value: `+${momentum}%`, color: "text-green-600" },
                { label: "Current Streak", value: `${state.streakDays ?? 0} days`, color: "text-orange-500" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{m.label}</p>
                  <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
            <Link href="/signals">
              <div className="mt-4 flex items-center justify-center gap-1 text-sm text-green-600 hover:text-green-700 cursor-pointer font-medium">
                View Signals <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Next Up</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer">
                <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Tomorrow</p>
                  <p className="text-xs text-gray-500">{orders.length} orders queued</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Focus</p>
                  <p className="text-xs text-gray-500">Prioritize highest-leverage execution orders</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h3>
            <div className="space-y-1">
              {[
                { label: "View Orders", href: "/orders" },
                { label: "Submit Feedback", href: "/feedback" },
                { label: "Strategy Review", href: "/strategy" },
              ].map((a) => (
                <Link key={a.href} href={a.href}>
                  <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <span className="text-sm text-gray-700">{a.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
