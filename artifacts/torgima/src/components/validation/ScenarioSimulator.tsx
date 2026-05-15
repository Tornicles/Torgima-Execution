import type { PathView } from "./PathPanels";

export function ScenarioSimulator({
  alternativePath,
  tier,
}: {
  alternativePath?: PathView;
  tier?: string | null;
}) {
  if (tier !== "ultimate" || !alternativePath?.scenario) return null;

  const { bestCase, likelyCase, worstCase, probabilityOfSuccess } = alternativePath.scenario;

  return (
    <div className="border border-violet-200 rounded-xl p-4 bg-violet-50/50 space-y-3">
      <div>
        <h4 className="font-semibold text-sm text-violet-950">Scenario simulator</h4>
        <p className="text-[10px] text-violet-600 uppercase mt-0.5">Ultimate — alternative path</p>
      </div>
      {probabilityOfSuccess != null && (
        <p className="text-sm text-violet-900">
          Estimated success probability:{" "}
          <span className="font-bold">{Math.round(probabilityOfSuccess * 100)}%</span>
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {bestCase && (
          <div className="rounded-lg bg-white p-3 ring-1 ring-emerald-200">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Best case</p>
            <p className="text-gray-800 mt-1">{bestCase}</p>
          </div>
        )}
        {likelyCase && (
          <div className="rounded-lg bg-white p-3 ring-1 ring-violet-200">
            <p className="text-[10px] font-bold uppercase text-violet-700">Likely</p>
            <p className="text-gray-800 mt-1">{likelyCase}</p>
          </div>
        )}
        {worstCase && (
          <div className="rounded-lg bg-white p-3 ring-1 ring-red-200">
            <p className="text-[10px] font-bold uppercase text-red-700">Worst case</p>
            <p className="text-gray-800 mt-1">{worstCase}</p>
          </div>
        )}
      </div>
    </div>
  );
}
