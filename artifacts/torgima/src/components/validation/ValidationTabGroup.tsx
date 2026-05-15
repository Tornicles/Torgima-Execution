import { useState } from "react";

const TAB_KEYS = ["market", "demand", "feasibility", "context"] as const;
const TAB_LABELS: Record<(typeof TAB_KEYS)[number], string> = {
  market: "Market",
  demand: "Demand",
  feasibility: "Feasibility",
  context: "Context",
};

export function ValidationTabGroup({ tabs, tier }: { tabs?: Record<string, Record<string, unknown>>; tier?: string | null }) {
  const visible =
    tier === "starter" ? (["market", "demand"] as const) : TAB_KEYS;
  const [active, setActive] = useState<(typeof TAB_KEYS)[number]>(visible[0]);

  if (!tabs) return null;

  const data = tabs[active] as Record<string, string | string[]> | undefined;
  if (!data) return null;

  return (
    <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {visible.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
              active === key ? "text-green-700 border-b-2 border-green-600 bg-green-50/50" : "text-gray-500"
            }`}
          >
            {TAB_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="p-4 grid sm:grid-cols-2 gap-3">
        {Object.entries(data).map(([k, v]) => {
          if (k === "source") return null;
          return (
            <div key={k} className="bg-gray-50 rounded-lg p-3">
              <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">{k.replace(/([A-Z])/g, " $1")}</p>
              {Array.isArray(v) ?
                <ul className="text-sm text-gray-800 list-disc list-inside">
                  {v.map((x) => (
                    <li key={String(x)}>{String(x)}</li>
                  ))}
                </ul>
              : <p className="text-sm text-gray-800">{String(v)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
