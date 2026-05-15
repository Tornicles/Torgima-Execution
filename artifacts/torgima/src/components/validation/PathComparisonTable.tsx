import type { PathKey } from "./PathPanels";

export interface PathView {
  title?: string;
  summary?: string;
  riskLevel?: string;
  expectedOutcome?: string;
}

export function PathComparisonTable({
  paths,
  tier,
}: {
  paths?: Partial<Record<PathKey, PathView>>;
  tier?: string | null;
}) {
  if (!paths || tier === "starter") return null;

  const rows: PathKey[] = ["current", "adjusted", "alternative"];
  const labels: Record<PathKey, string> = {
    current: "Current",
    adjusted: "Adjusted",
    alternative: "Alternative",
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h4 className="font-semibold text-sm text-gray-900">Path comparison</h4>
        <p className="text-[10px] text-gray-400 uppercase mt-0.5">Growth+</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-2 font-semibold">Path</th>
              <th className="px-4 py-2 font-semibold">Summary</th>
              <th className="px-4 py-2 font-semibold">Risk</th>
              <th className="px-4 py-2 font-semibold">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((key) => {
              const p = paths[key];
              if (!p) return null;
              return (
                <tr key={key} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{labels[key]}</td>
                  <td className="px-4 py-3 text-gray-700">{p.summary ?? p.title ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.riskLevel ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.expectedOutcome ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
