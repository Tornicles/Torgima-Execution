import { useEffect, useState } from "react";
import { Info, TrendingUp } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { OperationalAwarenessStrip } from "@/components/operational/OperationalAwarenessStrip";
import { useBlueprintStore } from "@/store/blueprintStore";

const CONDITIONS = ["Nothingness", "Danger", "Stability", "Power", "Affluence"];

const CONDITION_ICONS: Record<string, string> = {
  Nothingness: "○",
  Danger: "🛡️",
  Stability: "🛡️",
  Power: "⚡",
  Affluence: "👑",
};

function spectrumIndex(raw: string): number {
  const keys = ["nothingness", "danger", "stability", "power", "affluence"];
  const i = keys.indexOf(raw);
  if (i >= 0) return i;
  if (raw === "urgency") return 1;
  if (raw === "power_change") return 3;
  return 2;
}

interface ConditionPayload {
  condition?: string;
  durationDays?: number;
  escalationLevel?: number;
  recoveryRequired?: boolean;
  transitionReason?: string | null;
}

interface EnforcementPayload {
  phasePermission?: string;
  difficultyCap?: string;
  proofRequired?: boolean;
  maxTasksPerDay?: number;
}

export default function SignalsPage() {
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [conditionRow, setConditionRow] = useState<ConditionPayload | null>(null);
  const [enforcement, setEnforcement] = useState<EnforcementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const dash = useBlueprintStore((s) => s.dashboardProjection);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_BASE_URL}/api/signals/current`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/signals/history`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/condition/current`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([cur, hist, cond]) => {
        if (cur.ok) setSignals(cur.data as Record<string, unknown>);
        if (hist.ok) {
          const snaps = (hist.data as { snapshots?: unknown[] })?.snapshots ?? [];
          setHistory(snaps.slice(-14));
        }
        if (cond.ok) {
          const payload = cond.data as { condition?: ConditionPayload; enforcement?: EnforcementPayload };
          setConditionRow(payload.condition ?? null);
          setEnforcement(payload.enforcement ?? null);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const sig = signals?.signal as Record<string, unknown> | undefined;
  const condObj = signals?.condition as Record<string, unknown> | undefined;
  const conditionRaw = (
    conditionRow?.condition ??
    (sig?.assignedCondition as string) ??
    (condObj?.condition as string) ??
    (sig?.condition as string) ??
    "stability"
  ).toLowerCase();
  const conditionDisplay = conditionRaw.replace(/_/g, " ");
  const activeConditionIdx = spectrumIndex(conditionRaw);

  const completionRate = Math.round(((sig?.completionRate as number) ?? 0) * 100);
  const weightedNum = Number((sig?.weightedScore as number) ?? 0);
  const weightedScore = weightedNum.toFixed(1);
  const momentum = (sig?.momentum as number) ?? 0;
  const streak = (sig?.streakDays as number) ?? 0;
  const confidence = (sig?.confidence as string) ?? "medium";

  const clamp10 = (n: number) => Math.min(10, Math.max(0, Number(n.toFixed(1))));

  const CHARACTER_TRAITS = [
    { label: "Completion signal", score: clamp10(completionRate / 10) },
    { label: "Weighted execution score", score: clamp10(weightedNum) },
    { label: "Momentum integer", score: clamp10(momentum / 1.5) },
    {
      label: "Composite signal read",
      score: clamp10((completionRate / 10 + weightedNum) / 2),
    },
    {
      label: "Confidence band (reported)",
      score: confidence === "high" ? 8.5 : confidence === "medium" ? 6.5 : 4.0,
    },
  ];

  const CONDITION_CONFIG: Record<string, { textColor: string; desc: string }> = {
    stability: {
      textColor: "text-green-600",
      desc: "Condition stable — enforcement and proofs follow current blueprint package.",
    },
    power: { textColor: "text-blue-600", desc: "Elevated conditioning window — expect expanded phase permission if enforcement allows." },
    affluence: {
      textColor: "text-purple-600",
      desc: "High-capacity stance — blueprint may emit denser execution orders.",
    },
    urgency: {
      textColor: "text-orange-600",
      desc: "Tight continuity — completion signal below midline triggers protective conditioning.",
    },
    danger: { textColor: "text-red-600", desc: "Recovery-oriented enforcement — proofs and safeguards tighten." },
    nothingness: { textColor: "text-gray-600", desc: "Baseline — first proof cycles hydrate the ledger." },
    power_change: { textColor: "text-amber-600", desc: "Transition recorded — follow enforcement deltas in the blueprint command center." },
  };

  const cfg = CONDITION_CONFIG[conditionRaw] ?? CONDITION_CONFIG.stability;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Signals Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Telemetry surfaced for blueprint conditioning — narration only.</p>
        </div>
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-white">
          <span>Last 14 days</span>
          {history.length > 0 && (
            <span className="text-gray-400 border-l border-gray-200 pl-2 ml-1">{history.length} snapshots</span>
          )}
        </div>
      </div>

      <OperationalAwarenessStrip
        awareness={dash?.operationalAwareness as string[] | undefined}
        signalBridge={dash?.signalBlueprintBridge as Array<{ headline?: string; cite?: string }> | undefined}
        executionIdentity={dash?.executionIdentityLines as string[] | undefined}
      />

      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Condition</p>
              <Info className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`text-3xl font-bold uppercase ${cfg.textColor}`}>{conditionDisplay}</span>
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  conditionRaw === "stability" || conditionRaw === "power" || conditionRaw === "affluence"
                    ? "bg-green-500"
                    : "bg-orange-500"
                } animate-pulse`}
              />
            </div>
            <p className="text-sm text-gray-500">{cfg.desc}</p>
            {conditionRow?.recoveryRequired && (
              <p className="text-xs text-orange-700 mt-2 font-medium">Recovery cycle active — complete proof-backed feedback to restore capacity.</p>
            )}
            {conditionRow?.transitionReason && (
              <p className="text-xs text-gray-500 mt-1">Transition: {conditionRow.transitionReason}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 xl:gap-6">
            {CONDITIONS.map((c, i) => {
              const isActive = i === activeConditionIdx;
              const condKey = c.toLowerCase();
              const colors: Record<string, string> = {
                nothingness: "text-gray-400 border-gray-300",
                danger: "text-red-500 border-red-400",
                stability: "text-green-600 border-green-500",
                power: "text-blue-600 border-blue-500",
                affluence: "text-purple-600 border-purple-500",
              };
              return (
                <div
                  key={c}
                  className={`flex flex-col items-center gap-2 ${isActive ? "opacity-100" : "opacity-40"}`}
                >
                  <div
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg ${
                      isActive ? colors[condKey] : "text-gray-300 border-gray-200"
                    }`}
                  >
                    {CONDITION_ICONS[c] ?? "○"}
                  </div>
                  <div className={`w-full h-1 rounded-full mt-1 ${isActive ? "bg-green-500" : "bg-transparent"}`} />
                  <span
                    className={`text-xs font-medium ${
                      isActive ? colors[condKey]?.split(" ")[0] : "text-gray-400"
                    }`}
                  >
                    {c}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="xl:ml-4 max-w-[220px] w-full bg-slate-50 rounded-xl p-4 border border-slate-100 shrink-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Authority boundary</p>
            <p className="text-sm text-slate-700 leading-relaxed">
              This view summarizes persisted signal telemetry. Interpretation cannot assign conditions or unlock blueprint phases —
              control systems own that authority.
            </p>
          </div>
        </div>
      </div>

      {enforcement && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Enforcement (plain language)</p>
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
            {enforcement.phasePermission && <li>Phase permission: {enforcement.phasePermission.replace(/_/g, " ")}</li>}
            {enforcement.difficultyCap && <li>Difficulty cap: {enforcement.difficultyCap}</li>}
            {enforcement.maxTasksPerDay != null && <li>Up to {enforcement.maxTasksPerDay} tasks per day</li>}
            {enforcement.proofRequired && <li>Proof required on completion reports</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Completion Rate",
            value: `${completionRate}%`,
            sub: "Current signal window aggregate",
            color: "text-green-600",
            chartColor: "stroke-green-500",
          },
          {
            label: "Daily Score",
            value: `${weightedScore}/10`,
            sub: "Current signal window aggregate",
            color: "text-purple-600",
            chartColor: "stroke-purple-500",
          },
          { label: "Momentum field", value: `${momentum}`, sub: "From snapshot normalization", color: "text-green-600", chartColor: "stroke-green-500" },
          {
            label: "Streak counter",
            value: `${streak}`,
            sub: "Snapshot momentum streak",
            color: "text-orange-500",
            chartColor: "stroke-orange-500",
          },
          {
            label: "Execution Level",
            value: completionRate > 80 ? "High" : completionRate > 60 ? "Medium" : completionRate > 40 ? "Building" : "Low",
            sub: "Keep it up",
            color: completionRate > 80 ? "text-green-600" : "text-orange-500",
            chartColor: "stroke-green-500",
          },
        ].map((metric) => (
          <div key={metric.label} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{metric.label}</p>
              <Info className="w-3 h-3 text-gray-300" />
            </div>
            <p className={`text-2xl font-bold ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-green-600">{metric.sub}</p>
            <svg height="32" width="100%" className="mt-1" aria-hidden>
              <polyline
                points="0,24 16,20 32,22 48,16 64,18 80,12 96,8"
                fill="none"
                className={metric.chartColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">14-Day Trend</h3>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white"
              aria-label="Metric"
            >
              <option>Completion Rate</option>
              <option>Daily Score</option>
              <option>Momentum</option>
            </select>
          </div>

          <div className="relative h-48">
            <div className="absolute inset-0 flex items-end">
              <svg className="w-full h-full" viewBox="0 0 700 160" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 40, 80, 120, 160].map((y) => (
                  <line key={y} x1="0" y1={y} x2="700" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                ))}
                <path
                  d="M 0,120 C 50,110 100,90 175,80 S 280,70 350,65 S 450,55 525,45 S 620,30 700,20 L 700,160 L 0,160 Z"
                  fill="url(#trendGrad)"
                />
                <path
                  d="M 0,120 C 50,110 100,90 175,80 S 280,70 350,65 S 450,55 525,45 S 620,30 700,20"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {[
                  [0, 120],
                  [100, 90],
                  [200, 78],
                  [300, 65],
                  [400, 58],
                  [525, 45],
                  [700, 20],
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="4" fill="white" stroke="#16a34a" strokeWidth="2" />
                ))}
              </svg>
            </div>
          </div>

          <div className="flex justify-between mt-3">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Today"].map((d) => (
              <span key={d} className="text-xs text-gray-400">
                {d}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 bg-green-50 rounded-xl p-3">
            <TrendingUp className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">You&apos;re trending in the right direction.</p>
              <p className="text-xs text-green-600">Keep showing up. Small actions compound.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900">Character Traits</h3>
              <Info className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-xs text-green-600 font-medium cursor-pointer">View All Traits →</span>
          </div>
          <div className="space-y-4">
            {CHARACTER_TRAITS.map((trait) => {
              const score = trait.score;
              const pct = (score / 10) * 100;
              const color = score >= 8 ? "bg-green-500" : score >= 6 ? "bg-yellow-500" : "bg-orange-500";
              return (
                <div key={trait.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-700">{trait.label}</span>
                    <span
                      className={`text-sm font-bold ${
                        score >= 8 ? "text-green-600" : score >= 6 ? "text-yellow-600" : "text-orange-500"
                      }`}
                    >
                      {score} / 10
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
