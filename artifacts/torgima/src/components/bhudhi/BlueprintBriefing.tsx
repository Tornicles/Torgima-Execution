import { IntelligencePanel } from "./IntelligencePanel";

export function BlueprintBriefing({
  interpretation,
  currentFocus,
  keyInsights,
}: {
  interpretation?: string | null;
  currentFocus?: string | null;
  keyInsights?: string[];
}) {
  const insights = (keyInsights ?? []).slice(0, 3);

  return (
    <div className="space-y-4">
      {interpretation ? (
        <IntelligencePanel type="briefing" title="Blueprint briefing" content={interpretation} />
      ) : null}
      {currentFocus ? (
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">Current focus: </span>
          {currentFocus}
        </p>
      ) : null}
      {insights.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {insights.map((insight) => (
            <div
              key={insight}
              className="rounded-xl border border-green-100 bg-green-50/50 p-3 text-xs text-gray-800"
            >
              {insight}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
