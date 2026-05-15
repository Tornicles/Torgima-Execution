import { useState } from "react";

type BlockData = Record<string, string | string[] | undefined>;

function Block({
  title,
  source,
  data,
  defaultOpen = true,
}: {
  title: string;
  source?: string;
  data: BlockData;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div>
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          {source && <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{source}</p>}
        </div>
        <span className="text-gray-400 text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100">
          {Object.entries(data).map(([k, v]) => {
            if (k === "source" || !v) return null;
            return (
              <div key={k}>
                <p className="text-[10px] uppercase text-gray-400 font-medium">{k.replace(/([A-Z])/g, " $1")}</p>
                {Array.isArray(v) ?
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {v.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                : <p className="text-sm text-gray-800">{v}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function IndustryIntelligencePanel({
  panel,
  tier,
}: {
  panel?: Record<string, unknown>;
  tier?: string | null;
}) {
  if (!panel) return null;
  const p = panel as {
    industryOverview?: BlockData;
    demandIntelligence?: BlockData;
    competitiveLandscape?: BlockData;
    executionReality?: BlockData;
    riskMap?: Array<{ title: string; level: string; trigger: string; prevention: string }>;
    strategicWindows?: BlockData;
    verdictContext?: BlockData;
  };

  const levelColor = (level: string) =>
    level === "critical" ? "text-red-700 bg-red-50"
    : level === "high" ? "text-orange-700 bg-orange-50"
    : level === "medium" ? "text-amber-700 bg-amber-50"
    : "text-green-700 bg-green-50";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Industry Intelligence</h3>
        <span className="text-xs text-gray-500 capitalize">{tier ?? "starter"} depth</span>
      </div>
      {p.industryOverview && <Block title="Industry Overview" source="EIS" data={p.industryOverview} />}
      {p.demandIntelligence && <Block title="Demand Intelligence" source="EIS" data={p.demandIntelligence} />}
      {p.competitiveLandscape && <Block title="Competitive Landscape" source="EIS + SIS" data={p.competitiveLandscape} />}
      {p.executionReality && <Block title="Execution Reality" source="SIS" data={p.executionReality} defaultOpen={tier !== "starter"} />}
      {p.riskMap && p.riskMap.length > 0 && (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-2">
          <p className="font-semibold text-sm">Risk Map</p>
          <p className="text-[10px] text-gray-400 uppercase">PIS + EIS</p>
          {p.riskMap.map((r) => (
            <div key={r.title} className={`rounded-lg p-3 text-sm ${levelColor(r.level)}`}>
              <p className="font-semibold">{r.title}</p>
              <p className="text-xs mt-1 opacity-90">Trigger: {r.trigger}</p>
              <p className="text-xs mt-0.5">Prevention: {r.prevention}</p>
            </div>
          ))}
        </div>
      )}
      {tier !== "starter" && p.strategicWindows && (
        <Block title="Strategic Windows" source="EIS" data={p.strategicWindows} defaultOpen={false} />
      )}
      {p.verdictContext && <Block title="Verdict Context" source="VerdictEngine" data={p.verdictContext} />}
    </div>
  );
}
