import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Target, AlertTriangle, Zap, Users } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

export default function IntelligencePage() {
  const [intel, setIntel] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/onboarding/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: { blueprintId?: string | null } }) => {
        const bid = d?.data?.blueprintId;
        if (!bid) return null;
        return fetch(`${API_BASE_URL}/api/intelligence/blueprint/${bid}`, { credentials: "include" });
      })
      .then((r) => (r ? r.json() : null))
      .then((d: { ok?: boolean; data?: Record<string, unknown> } | null) => {
        if (d?.ok && d.data) setIntel(d.data);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const momentumConfig = {
    growing: { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", label: "Growing" },
    declining: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-50", label: "Declining" },
    emerging: { icon: Zap, color: "text-blue-600", bg: "bg-blue-50", label: "Emerging" },
    oversaturated: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", label: "Oversaturated" },
    behavior_shifting: { icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50", label: "Behavior Shifting" },
  } as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-gray-500">No intelligence data yet.</p>
        <p className="text-xs text-gray-400">
          Activate a blueprint — market intelligence is generated at launch (and caches on your blueprint).
        </p>
      </div>
    );
  }

  const mm = intel.marketMomentum as keyof typeof momentumConfig | undefined;
  const momentum =
    mm && momentumConfig[mm]
      ? momentumConfig[mm]
      : { icon: TrendingUp, color: "text-green-600", bg: "bg-green-50", label: "Growing" };
  const MomentumIcon = momentum.icon;

  const positioning = intel.positioning as Record<string, string> | undefined;
  const whiteSpace = intel.whiteSpace as Record<string, string[]> | undefined;
  const similarCompanies = intel.similarCompanies as Array<Record<string, string>> | undefined;
  const strategicWarnings = intel.strategicWarnings as string[] | undefined;

  const label = momentum.label;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Strategic Intelligence</h1>
        <p className="text-gray-500 text-sm mt-1">
          Market framing, archetypes, whitespace, and positioning — tuned to your active blueprint.
        </p>
      </div>

      <div className={`rounded-2xl border p-6 ${momentum.bg}`}>
        <div className="flex items-center gap-3 mb-2">
          <MomentumIcon className={`w-6 h-6 ${momentum.color}`} />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Market Momentum</p>
        </div>
        <p className={`text-3xl font-bold ${momentum.color}`}>{label}</p>
        <p className="text-sm text-gray-600 mt-2">
          Category read: <strong>{String(intel.marketMomentum ?? "").replaceAll("_", " ")}</strong>. Timing changes how
          hard distribution and proof will hit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Strongest Angle</p>
          </div>
          <p className="text-gray-900 font-medium">{positioning?.strongestAngle}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Weakest Angle</p>
          </div>
          <p className="text-gray-900 font-medium">{positioning?.weakestAngle}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User Misconception Risk</p>
          </div>
          <p className="text-gray-900 font-medium">{positioning?.userMisconception}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Differentiation Opportunity
            </p>
          </div>
          <p className="text-gray-900 font-medium">{positioning?.differentiationOpportunity}</p>
        </div>
      </div>

      {similarCompanies && similarCompanies.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution Archetypes</p>
          <div className="space-y-3">
            {similarCompanies.map((company, i) => (
              <div key={`${company.name}-${i}`} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    company.outcome === "succeeded"
                      ? "bg-green-500"
                      : company.outcome === "failed"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{company.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        company.outcome === "succeeded"
                          ? "bg-green-100 text-green-700"
                          : company.outcome === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {company.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{company.reason}</p>
                  <p className="text-sm text-gray-700 font-medium">Lesson: {company.lesson}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Underserved Users</p>
          </div>
          <ul className="space-y-2">
            {whiteSpace?.underservedUsers?.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unclaimed Positioning</p>
          </div>
          <ul className="space-y-2">
            {whiteSpace?.unclaimedPositioning?.map((pText, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                {pText}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {strategicWarnings && strategicWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Strategic Warnings</p>
          </div>
          <ul className="space-y-2">
            {strategicWarnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-800">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
