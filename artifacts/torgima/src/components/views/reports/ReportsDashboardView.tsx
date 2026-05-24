import { FileText, Rocket } from "lucide-react";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { StickyFooter } from "@/components/design-system/StickyFooter";
import { cards, buttons, PageLoading } from "@/design";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

const TEMPLATES = [
  { title: "Validation Report", icon: Rocket, color: "text-emerald-600" },
  { title: "Blueprint Report", icon: FileText, color: "text-blue-600" },
  { title: "Weekly Progress Report", icon: FileText, color: "text-purple-600" },
  { title: "Program Performance", icon: FileText, color: "text-orange-600" },
  { title: "Character Report", icon: FileText, color: "text-emerald-600" },
];

const RECENT = [
  { name: "Weekly Progress Report", type: "Weekly", period: "May 15 – May 21", generated: "May 21, 2025" },
  { name: "Blueprint Overview", type: "Blueprint", period: "May 2025", generated: "May 20, 2025" },
];

export function ReportsDashboardView() {
  const { isLoading } = useDashboardMetrics();

  if (isLoading) return <PageLoading />;

  return (
    <DashboardPageLayout
      title="Reports"
      subtitle="Your execution in detail. Track, analyze, and improve."
      stats={
        <MetricStatRow>
          <MetricStatCard label="Reports Generated" value="32" sub="+18% vs last week" valueClassName="text-emerald-600" />
          <MetricStatCard label="Data Points" value="1,248" sub="+22% vs last week" valueClassName="text-blue-600" />
          <MetricStatCard label="Insights Revealed" value="86" sub="+15% vs last week" valueClassName="text-purple-600" />
          <MetricStatCard label="Exports" value="14" sub="+27% vs last week" valueClassName="text-orange-600" />
          <MetricStatCard label="Report Accuracy" value="98%" sub="High integrity" valueClassName="text-emerald-600" />
        </MetricStatRow>
      }
      rightRail={
        <>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Report insights</p>
            <ul className="text-sm space-y-2 text-gray-700">
              <li className="text-emerald-700">Strong week — execution up 18%</li>
              <li className="text-orange-700">Focus consistency slightly dropped</li>
              <li className="text-purple-700">92% of major priorities completed</li>
            </ul>
          </div>
          <div className={cards.padded}>
            <p className="text-xs font-bold uppercase text-gray-500 mb-3">Scheduled reports</p>
            <p className="text-sm text-gray-600">Weekly Progress — Mondays 9:00 AM</p>
            <p className="text-sm text-gray-600 mt-2">Monthly Performance — 1st of month</p>
          </div>
        </>
      }
      footer={
        <StickyFooter
          message="Every report is a mirror. Every insight is a lever. Use the data. Win faster."
          action={
            <button type="button" className={`${buttons.primary} inline-flex items-center gap-2`} onClick={() => window.print()}>
              <FileText className="w-4 h-4" /> Generate Report
            </button>
          }
        />
      }
    >
      <div>
        <p className="text-xs font-bold uppercase text-gray-500 mb-3">Available reports</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.title} className={cards.padded}>
              <t.icon className={`w-8 h-8 mb-3 ${t.color}`} />
              <p className="font-semibold text-sm">{t.title}</p>
              <button type="button" className={`mt-4 w-full text-sm ${buttons.secondary}`}>
                Generate Report
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Recent reports</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b">
              <th className="pb-2">Report</th>
              <th className="pb-2">Type</th>
              <th className="pb-2">Period</th>
              <th className="pb-2">Generated</th>
            </tr>
          </thead>
          <tbody>
            {RECENT.map((r) => (
              <tr key={r.name} className="border-b border-gray-50">
                <td className="py-3 font-medium">{r.name}</td>
                <td className="py-3">{r.type}</td>
                <td className="py-3 text-gray-500">{r.period}</td>
                <td className="py-3 text-gray-500">{r.generated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardPageLayout>
  );
}
