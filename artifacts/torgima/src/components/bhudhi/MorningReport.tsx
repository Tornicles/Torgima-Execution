import { IntelligencePanel } from "./IntelligencePanel";
import { Calendar } from "lucide-react";

export interface MorningReportData {
  reportDate?: string;
  eisSection?: Record<string, unknown>;
  nextTaskPreview?: { orderId?: string } | null;
}

export function MorningReport({ report }: { report: MorningReportData | null }) {
  if (!report?.eisSection) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
        Intelligence report generating tonight. Check back tomorrow morning.
      </div>
    );
  }

  const section = report.eisSection;
  const topics = (section.trendingTopics as string[] | undefined) ?? [];
  const recommendation =
    typeof section.recommendation === "string" ?
      section.recommendation
    : typeof section.executionImplication === "string" ?
      section.executionImplication
    : "Focus on your active Order today.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide font-semibold">
        <Calendar className="w-3.5 h-3.5" />
        Intelligence Report · {report.reportDate ?? "Today"}
      </div>
      {topics.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {topics.slice(0, 3).map((t) => (
            <div key={t} className="rounded-xl border border-gray-100 bg-white p-3 text-xs text-gray-700">
              {t}
            </div>
          ))}
        </div>
      )}
      <IntelligencePanel
        type="report"
        title="Today's recommendation"
        content={recommendation}
        confidenceTier="MEDIUM"
        expandable
      />
    </div>
  );
}
