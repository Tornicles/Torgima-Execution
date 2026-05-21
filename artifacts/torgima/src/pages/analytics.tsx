import { useCallback, useEffect, useState } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TimeWindow = "today" | "week" | "month" | "all-time";

type ExecutionDashboard = {
  completionRate?: number;
  executionMomentum?: number;
  totalOrdersCompleted?: number;
  averageOrderScore?: number;
  peakProductivityHour?: number | null;
  patterns?: Array<{ pattern_description: string; actionable_insight?: string }>;
  benchmarks?: Array<{ metric_name: string; current_value: number; trend: string }>;
};

type PrinciplesDashboard = {
  principlesApplied?: number;
  currentStreak?: number;
  topPrinciples?: Array<{ effectiveness_score: number; principle_id: string }>;
};

type AcademyDashboard = {
  coursesEnrolled?: number;
  lessonsCompleted?: number;
  learningVelocity?: number;
};

type ContentDashboard = {
  postsPublished?: number;
  totalEngagement?: number;
  viralityScore?: number;
};

type IntegratedDashboard = {
  execution?: ExecutionDashboard;
  principles?: PrinciplesDashboard;
  academy?: AcademyDashboard;
  content?: ContentDashboard;
  insights?: string[];
};

const TABS = [
  { id: "integrated", label: "Overview" },
  { id: "execution", label: "Execution" },
  { id: "principles", label: "Principles" },
  { id: "academy", label: "Academy" },
  { id: "content", label: "Content" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: "week", label: "7d" },
  { id: "month", label: "30d" },
  { id: "all-time", label: "All" },
];

function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

function num(n?: number, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits);
}

export default function AnalyticsPage() {
  const { data: me } = useGetMe();
  const userId = me?.id;
  const [tab, setTab] = useState<TabId>("integrated");
  const [window, setWindow] = useState<TimeWindow>("month");
  const [loading, setLoading] = useState(true);
  const [integrated, setIntegrated] = useState<IntegratedDashboard | null>(null);
  const [execution, setExecution] = useState<ExecutionDashboard | null>(null);
  const [principles, setPrinciples] = useState<PrinciplesDashboard | null>(null);
  const [academy, setAcademy] = useState<AcademyDashboard | null>(null);
  const [content, setContent] = useState<ContentDashboard | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [heatmap, setHeatmap] = useState<
    Array<{ day_of_week: number; hour_of_day: number; orders_completed: number }>
  >([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const q = `timeWindow=${window}`;
      const [intRes, execRes, prRes, acRes, coRes, insRes, heatRes] = await Promise.all([
        apiGet<{ dashboard: IntegratedDashboard }>(
          `/api/analytics/dashboard/integrated/${userId}`,
        ).catch(() => null),
        apiGet<{ dashboard: ExecutionDashboard }>(
          `/api/analytics/dashboard/execution/${userId}?${q}`,
        ).catch(() => null),
        apiGet<{ dashboard: PrinciplesDashboard }>(
          `/api/analytics/dashboard/principles/${userId}?${q}`,
        ).catch(() => null),
        apiGet<{ dashboard: AcademyDashboard }>(
          `/api/analytics/dashboard/academy/${userId}?${q}`,
        ).catch(() => null),
        apiGet<{ dashboard: ContentDashboard }>(
          `/api/analytics/dashboard/content/${userId}?${q}`,
        ).catch(() => null),
        apiGet<{ insights: string[] }>(`/api/analytics/insights/${userId}`).catch(() => null),
        apiGet<{ heatmap: Array<{ day_of_week: number; hour_of_day: number; orders_completed: number }> }>(
          `/api/analytics/heatmap/${userId}`,
        ).catch(() => null),
      ]);
      if (intRes?.dashboard) setIntegrated(intRes.dashboard);
      if (execRes?.dashboard) setExecution(execRes.dashboard);
      if (prRes?.dashboard) setPrinciples(prRes.dashboard);
      if (acRes?.dashboard) setAcademy(acRes.dashboard);
      if (coRes?.dashboard) setContent(coRes.dashboard);
      if (insRes?.insights) setInsights(insRes.insights);
      if (heatRes?.heatmap) setHeatmap(heatRes.heatmap);
    } finally {
      setLoading(false);
    }
  }, [userId, window]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recompute() {
    if (!userId) return;
    await apiPost("/api/analytics/compute", {});
    await load();
  }

  async function exportJson() {
    if (!userId) return;
    setExporting(true);
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const data = await apiPost<Record<string, unknown>>("/api/analytics/export", {
        startDate: start.toISOString().slice(0, 10),
        endDate: end,
        format: "json",
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "torgima-analytics.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const peakCells = [...heatmap]
    .sort((a, b) => b.orders_completed - a.orders_completed)
    .slice(0, 5);

  const activeExecution = tab === "execution" ? execution : integrated?.execution ?? execution;
  const activePrinciples = tab === "principles" ? principles : integrated?.principles ?? principles;
  const activeAcademy = tab === "academy" ? academy : integrated?.academy ?? academy;
  const activeContent = tab === "content" ? content : integrated?.content ?? content;
  const activeInsights = integrated?.insights?.length ? integrated.insights : insights;

  return (
    <Layout pageTitle="Analytics" pageSubtitle="Execution patterns, learning velocity, and content performance">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1 bg-gray-50">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  tab === t.id ? "bg-white shadow text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
              {WINDOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWindow(w.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    window === w.id ? "bg-green-600 text-white" : "text-gray-600"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => void recompute()} disabled={loading}>
              Refresh data
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportJson()} disabled={exporting}>
              Export JSON
            </Button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500">Loading analytics…</p>
        )}

        {!loading && activeInsights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bhudhi insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                {activeInsights.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {(tab === "integrated" || tab === "execution") && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Completion rate" value={pct(activeExecution?.completionRate)} />
            <MetricCard
              label="Momentum"
              value={num(activeExecution?.executionMomentum, 2)}
              hint="-1 declining → +1 accelerating"
            />
            <MetricCard label="Orders done" value={String(activeExecution?.totalOrdersCompleted ?? "—")} />
            <MetricCard label="Avg score" value={num(activeExecution?.averageOrderScore, 0)} />
          </div>
        )}

        {(tab === "integrated" || tab === "execution") && peakCells.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Productivity heatmap (top slots)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {peakCells.map((c, i) => (
                <div key={i} className="flex justify-between text-sm text-gray-700">
                  <span>
                    {dayNames[c.day_of_week]} {c.hour_of_day}:00
                  </span>
                  <span className="font-medium">{c.orders_completed} completions</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(tab === "integrated" || tab === "principles") && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="Principles applied" value={String(activePrinciples?.principlesApplied ?? "—")} />
            <MetricCard label="Principle streak" value={String(activePrinciples?.currentStreak ?? "—")} />
            <MetricCard
              label="Top effectiveness"
              value={
                activePrinciples?.topPrinciples?.[0]
                  ? num(activePrinciples.topPrinciples[0].effectiveness_score, 0)
                  : "—"
              }
            />
          </div>
        )}

        {(tab === "integrated" || tab === "academy") && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="Courses enrolled" value={String(activeAcademy?.coursesEnrolled ?? "—")} />
            <MetricCard label="Lessons completed" value={String(activeAcademy?.lessonsCompleted ?? "—")} />
            <MetricCard label="Learning velocity" value={num(activeAcademy?.learningVelocity, 1)} />
          </div>
        )}

        {(tab === "integrated" || tab === "content") && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label="Posts published" value={String(activeContent?.postsPublished ?? "—")} />
            <MetricCard label="Total engagement" value={String(activeContent?.totalEngagement ?? "—")} />
            <MetricCard label="Virality score" value={num(activeContent?.viralityScore, 0)} />
          </div>
        )}

        {(tab === "integrated" || tab === "execution") &&
          (activeExecution?.patterns?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detected patterns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeExecution!.patterns!.map((p, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-gray-900">{p.pattern_description}</p>
                    {p.actionable_insight && (
                      <p className="text-gray-600 mt-0.5">{p.actionable_insight}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
      </div>
    </Layout>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
