import type { TierId } from "@/components/blueprint/BlueprintSelectionPanel";

export type PathKey = "current" | "adjusted" | "alternative";

export interface PathView {
  title?: string;
  summary?: string;
  rationale?: string;
  expectedOutcome?: string;
  riskLevel?: string;
  strengths?: string[];
  risks?: string[];
  whatChanged?: string[];
  scenario?: {
    bestCase?: string;
    likelyCase?: string;
    worstCase?: string;
    probabilityOfSuccess?: number;
  };
}

export function PathPanels({
  paths,
  selectedPath,
  onSelectPath,
  tier,
  verdict,
}: {
  paths?: Partial<Record<PathKey, PathView>>;
  selectedPath: PathKey;
  onSelectPath: (p: PathKey) => void;
  tier?: TierId | null;
  verdict?: string;
}) {
  if (!paths) return null;

  const visible: PathKey[] =
    tier === "starter" ?
      verdict === "adjust" ? ["current", "adjusted"]
      : ["current"]
    : ["current", "adjusted", "alternative"];

  const labels: Record<PathKey, { label: string; icon: string }> = {
    current: { label: "Current Path", icon: "🚩" },
    adjusted: { label: "Adjusted Path", icon: "⚙️" },
    alternative: { label: "Alternative Path", icon: "↗️" },
  };

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-gray-900">Strategic Paths</h3>
      {visible.map((key) => {
        const path = paths[key];
        if (!path) return null;
        const isSelected = selectedPath === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectPath(key)}
            className={`w-full text-left border-2 rounded-xl p-4 transition-all ${
              isSelected ? "border-green-500 bg-white shadow-sm" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span>{labels[key].icon}</span>
              <p className="font-semibold text-sm">{labels[key].label}</p>
              {key === "adjusted" && verdict === "adjust" && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">{path.summary}</p>
            {tier !== "starter" && path.strengths && path.strengths.length > 0 && (
              <p className="text-xs text-green-700 mt-2">+ {path.strengths.join(" · ")}</p>
            )}
            {tier !== "starter" && path.risks && path.risks.length > 0 && (
              <p className="text-xs text-orange-700 mt-1">Risks: {path.risks.join(" · ")}</p>
            )}
            {path.whatChanged && path.whatChanged.length > 0 && (
              <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                {path.whatChanged.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            {tier === "ultimate" && path.scenario?.probabilityOfSuccess !== undefined && (
              <p className="text-xs font-semibold text-indigo-700 mt-2">
                P(success): {path.scenario.probabilityOfSuccess}%
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
