import { Link } from "wouter";
import { Calendar, Flag, Shield, TrendingUp } from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { ProgressBar } from "@/components/design-system/ProgressBar";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { cards, buttons, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

export function StrategyDashboardView() {
  const { completionRate, momentum, conditionLabel, journeyDay, blueprint, isLoading } = useDashboardMetrics();
  const overall = Math.min(100, Math.round(completionRate * 1.2) || 26);

  if (isLoading) return <PageLoading />;

  const paths = [
    { key: "current", title: "Current Path", success: 65, time: "9–12 Months", risk: "Medium", active: true },
    { key: "adjusted", title: "Adjusted Path", success: 82, time: "6–9 Months", risk: "Low", recommended: true },
    { key: "alternative", title: "Alternative Path", success: 58, time: "10–14 Months", risk: "High" },
  ];

  return (
    <DashboardPageLayout
      title="Strategy"
      subtitle="Make better decisions. Adjust with clarity. Move with confidence."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Current Direction" value="Adjusted Path" sub="Recommended" valueClassName="text-emerald-600" icon={<Flag className="w-5 h-5 text-emerald-500" />} />
          <MetricStatCard label="Strategy Health" value="82%" sub="Strong alignment" valueClassName="text-emerald-600" icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} />
          <MetricStatCard label="Pivot Risk" value="Low" sub="No pivot signals" valueClassName="text-emerald-600" icon={<Shield className="w-5 h-5 text-emerald-500" />} />
          <MetricStatCard label="Last Review" value="2 days ago" sub="Review weekly" icon={<Calendar className="w-5 h-5 text-blue-500" />} />
        </MetricStatRow>
      }
      rightRail={
        <div className={cards.padded}>
          <p className="text-xs font-bold uppercase text-gray-500 mb-3">Strategy alerts</p>
          <ul className="text-sm space-y-3">
            <li className="text-orange-700">Watch competitor pressure</li>
            <li className="text-blue-700">Market shift detected</li>
            <li className="text-emerald-700">Execution is on track</li>
          </ul>
        </div>
      }
      footer={
        <StickyFooter
          message="Strategy keeps your execution aligned with reality. Review weekly. Adapt early."
          action={
            blueprint?.id ? (
              <Link href={`/blueprint/${blueprint.id}`}>
                <span className={`${buttons.primary} inline-block`}>Review Strategy Now →</span>
              </Link>
            ) : (
              <Link href="/blueprint">
                <span className={`${buttons.primary} inline-block`}>View Blueprint →</span>
              </Link>
            )
          }
        />
      }
    >
      <div className={cards.padded}>
        <p className="text-emerald-700 font-medium mb-4">Your current direction is working. Stay consistent.</p>
        <div className="grid sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Progress</p>
            <p className="font-bold">{overall}%</p>
            <p className="text-xs text-gray-500">Day {journeyDay}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Momentum</p>
            <p className="font-bold text-emerald-600">+{momentum}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Condition</p>
            <p className="font-bold">{conditionLabel}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Trend</p>
            <p className="font-bold text-emerald-600">Positive</p>
          </div>
        </div>
        <ProgressBar value={overall} className="mt-4" />
      </div>

      <div>
        <p className="text-xs font-bold uppercase text-gray-500 mb-3">2. Pathway comparison</p>
        <div className="grid lg:grid-cols-3 gap-4">
          {paths.map((p) => (
            <div
              key={p.key}
              className={`${cards.padded} ${p.recommended ? "border-emerald-300 ring-1 ring-emerald-100" : ""}`}
            >
              {p.recommended && (
                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              <h3 className="font-bold mt-2">{p.title}</h3>
              <p className="text-sm text-gray-600 mt-2">Success: {p.success}%</p>
              <p className="text-sm text-gray-600">Time: {p.time}</p>
              <p className="text-sm mt-1">Risk: {p.risk}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardPageLayout>
  );
}
