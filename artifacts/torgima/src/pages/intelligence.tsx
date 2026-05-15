import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  Target,
  Users,
  Shield,
  Eye,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { OperationalAwarenessStrip } from "@/components/operational/OperationalAwarenessStrip";
import { useBlueprintStore } from "@/store/blueprintStore";

interface RealityIntelligence {
  marketMomentum: string;
  demandConfidence: string;
  trendExplanation: string;
  similarConcepts?: Array<{
    name: string;
    reason: string;
    outcome: string;
    lesson: string;
    differentiationInsight: string;
  }>;
  positioning?: {
    strongestAngle: string;
    weakestAngle: string;
    userMisconception: string;
    differentiationPath: string;
    positioningRule: string;
  };
  whiteSpace?: {
    underservedUsers: string[];
    emotionalGaps?: string[];
    executionGaps: string[];
    competitorWeaknesses: string[];
    unclaimedPositioning: string[];
    opportunityPath?: string;
  };
  timingAnalysis?: {
    risk: string;
    opportunity: string;
    urgency: string;
    reason: string;
  };
  strategicWarnings?: string[];
  blueprintSeedInstructions?: string;
  executionImplication?: string;
}

export default function IntelligencePage() {
  const [intel, setIntel] = useState<RealityIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const dash = useBlueprintStore((s) => s.dashboardProjection);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: { activeBlueprintId?: string | null } }) => {
        const bid = d?.data?.activeBlueprintId;
        if (!bid) return null;
        setBlueprintId(bid);
        return fetch(`${API_BASE_URL}/api/intelligence/blueprint/${bid}`, { credentials: "include" });
      })
      .then((r) => (r ? r.json() : null))
      .then((d: { ok?: boolean; data?: RealityIntelligence } | null) => {
        if (d?.ok && d.data) setIntel(d.data);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    if (!blueprintId || !API_BASE_URL) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/intelligence/blueprint/${blueprintId}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) setIntel(data.data as RealityIntelligence);
    } finally {
      setRefreshing(false);
    }
  }

  const momentumConfig: Record<
    string,
    { color: string; bg: string; border: string; label: string; icon: typeof TrendingUp }
  > = {
    growing: { color: "text-green-700", bg: "bg-green-50", border: "border-green-200", label: "Growing", icon: TrendingUp },
    declining: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", label: "Declining", icon: TrendingDown },
    emerging: { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", label: "Emerging", icon: Zap },
    oversaturated: {
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
      label: "Oversaturated",
      icon: AlertTriangle,
    },
    behavior_shifting: {
      color: "text-purple-700",
      bg: "bg-purple-50",
      border: "border-purple-200",
      label: "Behavior Shifting",
      icon: TrendingUp,
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">Loading intelligence data</p>
      </div>
    );
  }

  if (!intel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <Eye className="w-8 h-8 text-gray-300" />
        <p className="font-semibold text-gray-700">No intelligence data available</p>
        <p className="text-sm text-gray-400 max-w-xs">
          Activate a blueprint — strategic intelligence is generated at launch and can be refreshed here.
        </p>
      </div>
    );
  }

  const momentum = momentumConfig[intel.marketMomentum] ?? momentumConfig.growing!;
  const MomentumIcon = momentum.icon;

  const urgencyConfig = {
    immediate: { color: "text-red-600", bg: "bg-red-50", label: "Immediate" },
    moderate: { color: "text-amber-600", bg: "bg-amber-50", label: "Moderate" },
    patient: { color: "text-green-600", bg: "bg-green-50", label: "Patient" },
  };
  const u = intel.timingAnalysis?.urgency?.toLowerCase() ?? "moderate";
  const urgency =
    urgencyConfig[u as keyof typeof urgencyConfig] ?? urgencyConfig.moderate;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Strategic Intelligence</h1>
          <p className="text-gray-500 text-sm mt-1">
            Interpretive framing grounded in your goal — not claimed live telemetry.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Regenerate framing
        </button>
      </div>

      <OperationalAwarenessStrip
        awareness={dash?.operationalAwareness as string[] | undefined}
        signalBridge={dash?.signalBlueprintBridge as Array<{ headline?: string; cite?: string }> | undefined}
        executionIdentity={dash?.executionIdentityLines as string[] | undefined}
      />

      {intel.executionImplication ? (
        <div className="bg-gray-900 text-white rounded-2xl p-6 space-y-2">
          <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Primary execution implication</p>
          <p className="text-lg font-semibold leading-relaxed">{intel.executionImplication}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded-2xl border p-6 space-y-3 ${momentum.bg} ${momentum.border}`}>
          <div className="flex items-center gap-2">
            <MomentumIcon className={`w-5 h-5 ${momentum.color}`} />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Market momentum (framing)</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className={`text-3xl font-bold ${momentum.color}`}>{momentum.label}</p>
            <span
              className={`text-xs px-2 py-1 rounded-full font-semibold ${
                intel.demandConfidence === "high"
                  ? "bg-green-100 text-green-700"
                  : intel.demandConfidence === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {intel.demandConfidence?.toUpperCase()} CONFIDENCE
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{intel.trendExplanation}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Timing analysis</p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${urgency.bg} ${urgency.color}`}>
            Urgency: {urgency.label}
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-semibold uppercase">Opportunity</p>
              <p className="text-sm text-gray-700">{intel.timingAnalysis?.opportunity}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-semibold uppercase">Risk</p>
              <p className="text-sm text-gray-700">{intel.timingAnalysis?.risk}</p>
            </div>
            <p className="text-xs text-gray-500">{intel.timingAnalysis?.reason}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <p className="font-semibold text-gray-900">Strategic positioning</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase">Strongest angle</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">{intel.positioning?.strongestAngle}</p>
          </div>
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase">Weakest angle</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">{intel.positioning?.weakestAngle}</p>
          </div>
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase">User misconception risk</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">{intel.positioning?.userMisconception}</p>
          </div>
          <div className="p-5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-xs font-semibold text-gray-400 uppercase">Differentiation path</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">{intel.positioning?.differentiationPath}</p>
          </div>
        </div>
        {intel.positioning?.positioningRule ? (
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Positioning rule</p>
            <p className="text-sm text-gray-700 italic">{intel.positioning.positioningRule}</p>
          </div>
        ) : null}
      </div>

      {intel.similarConcepts && intel.similarConcepts.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="font-semibold text-gray-900">Execution archetypes</p>
            <p className="text-xs text-gray-400 mt-0.5">Comparable patterns — illustrative, not predictions</p>
          </div>
          <div className="divide-y divide-gray-50">
            {intel.similarConcepts.map((concept, i) => (
              <div key={i} className="p-5 flex items-start gap-4">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                    concept.outcome === "succeeded" ? "bg-green-500" : concept.outcome === "failed" ? "bg-red-500" : "bg-yellow-500"
                  }`}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{concept.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        concept.outcome === "succeeded"
                          ? "bg-green-100 text-green-700"
                          : concept.outcome === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {concept.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{concept.reason}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase">Lesson</p>
                      <p className="text-sm text-gray-700">{concept.lesson}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-400 uppercase">Differentiation insight</p>
                      <p className="text-sm text-blue-800">{concept.differentiationInsight}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Underserved operators</p>
          </div>
          <ul className="space-y-2">
            {intel.whiteSpace?.underservedUsers?.map((u, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                {u}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Competitor weaknesses (framing)</p>
          </div>
          <ul className="space-y-2">
            {intel.whiteSpace?.competitorWeaknesses?.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution gaps</p>
          <ul className="space-y-2">
            {intel.whiteSpace?.executionGaps?.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Unclaimed positioning</p>
          <ul className="space-y-2">
            {intel.whiteSpace?.unclaimedPositioning?.map((pItem, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                {pItem}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {intel.whiteSpace?.opportunityPath ? (
        <div className="bg-green-900 text-white rounded-2xl p-6 space-y-2">
          <p className="text-xs font-mono text-green-300 uppercase tracking-wider">Highest leverage opportunity (framing)</p>
          <p className="text-lg font-semibold leading-relaxed">{intel.whiteSpace.opportunityPath}</p>
        </div>
      ) : null}

      {intel.blueprintSeedInstructions ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Blueprint seed instructions</p>
          <p className="text-sm text-gray-700">{intel.blueprintSeedInstructions}</p>
        </div>
      ) : null}

      {intel.strategicWarnings && intel.strategicWarnings.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Strategic warnings</p>
          </div>
          <ul className="space-y-2">
            {intel.strategicWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
