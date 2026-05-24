import { useEffect, useState } from "react";
import { apiGet } from "@/lib/torgima-api";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { DonutProgress } from "@/components/design-system/DonutProgress";
import { cards, buttons, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { TrendChart } from "@/components/design-system/TrendChart";

type CharacterPayload = {
  consistency?: number;
  grit?: number;
  discipline?: number;
  executionIntelligence?: number;
  adaptability?: number;
  overallCharacterScore?: number;
};

const TRAITS = [
  { key: "consistency", label: "Consistency", desc: "Showing up daily" },
  { key: "discipline", label: "Discipline", desc: "Following through" },
  { key: "grit", label: "Grit", desc: "Persistence under pressure" },
  { key: "executionIntelligence", label: "Execution Intelligence", desc: "Smart prioritization" },
  { key: "adaptability", label: "Adaptability", desc: "Adjusting to reality" },
] as const;

function traitScore(v: number) {
  return v <= 1 ? Math.round(v * 100) / 10 : v;
}

export function CharacterDashboardView() {
  const { momentum, streak, isLoading: dashLoading } = useDashboardMetrics();
  const [character, setCharacter] = useState<CharacterPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ character?: CharacterPayload }>("/api/character/current")
      .then((d) => setCharacter(d?.character ?? null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || dashLoading) return <PageLoading />;

  const overall = Math.round((character?.overallCharacterScore ?? 0.78) * 100);
  const traitRows = TRAITS.map((t) => ({
    ...t,
    score: traitScore(character?.[t.key] ?? 7),
  }));

  return (
    <DashboardPageLayout
      title="Character"
      subtitle="Build the person who builds the results."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Character Score" value={`${overall} / 100`} sub="Strong foundation" valueClassName="text-emerald-600" />
          <MetricStatCard label="Growth Rate" value={`${momentum >= 0 ? "+" : ""}${momentum}%`} sub="vs last week" valueClassName="text-purple-600" />
          <MetricStatCard label="Consistency Streak" value={`${streak} days`} sub="Keep it up" valueClassName="text-orange-500" />
          <MetricStatCard label="Trait Balance" value="Good" sub="Well distributed" />
          <MetricStatCard label="Long Term Trend" value="Improving" sub="Upward trajectory" valueClassName="text-emerald-600" />
        </MetricStatRow>
      }
      rightRail={
        <div className={cards.padded}>
          <p className="text-xs font-bold uppercase text-gray-500 mb-3">Character insights</p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>Consistency is your strongest asset.</li>
            <li>Build grit during tougher phases.</li>
            <li>Momentum field: {momentum >= 0 ? "+" : ""}{momentum}%</li>
          </ul>
        </div>
      }
    >
      <div className={`${cards.padded} grid md:grid-cols-2 gap-6`}>
        <div>
          <p className="text-xs font-bold uppercase text-gray-500 mb-4">Core character traits</p>
          <ul className="space-y-4">
            {traitRows.map((t) => (
              <li key={t.key}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{t.label}</span>
                  <span className="font-bold text-emerald-600">{t.score.toFixed(1)} / 10</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{t.desc}</p>
                <ProgressBar value={(t.score / 10) * 100} />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-center justify-center">
          <DonutProgress value={overall} />
          <p className="text-sm text-gray-500 mt-4">Trait breakdown</p>
        </div>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Character evolution</p>
        <TrendChart points={[62, 65, 68, 70, 72, 75, overall]} labels={["Apr", "", "", "", "", "", "Now"]} />
      </div>

      <button type="button" className={`w-full ${buttons.primary}`}>
        Start Daily Practice →
      </button>
    </DashboardPageLayout>
  );
}
