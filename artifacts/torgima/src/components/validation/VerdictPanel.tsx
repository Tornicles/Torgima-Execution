export function VerdictPanel({
  verdict,
  reasoning,
  launchBlocked,
  onLaunch,
  launching,
}: {
  verdict?: string;
  reasoning?: string;
  launchBlocked?: boolean;
  onLaunch?: () => void;
  launching?: boolean;
}) {
  const v = verdict ?? "adjust";
  const cfg =
    v === "proceed" ?
      { label: "PROCEED", bg: "bg-green-600", msg: "You can proceed. Your direction is validated." }
    : v === "pivot" ?
      { label: "PIVOT REQUIRED", bg: "bg-red-600", msg: "Blueprint launch is blocked until direction changes." }
    : { label: "ADJUST", bg: "bg-amber-500", msg: "Adjustments recommended. Review the Adjusted Path." };

  const blocked = launchBlocked || v === "pivot";

  return (
    <div className="border-2 border-gray-200 rounded-2xl p-5 bg-white space-y-3 sticky top-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verdict</p>
      <span className={`inline-block px-4 py-2 rounded-lg text-white text-sm font-bold ${cfg.bg}`}>{cfg.label}</span>
      <p className="text-sm text-gray-800 font-medium">{cfg.msg}</p>
      {reasoning && <p className="text-sm text-gray-600 leading-relaxed">{reasoning}</p>}
      {blocked && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-800">
          Launch Blueprint is disabled. Edit your goal or select a recovery path, then re-validate.
        </div>
      )}
      {onLaunch && (
        <button
          type="button"
          disabled={blocked || launching}
          onClick={onLaunch}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {launching ? "Launching…" : blocked ? "Launch Blocked" : "Launch Blueprint"}
        </button>
      )}
    </div>
  );
}
