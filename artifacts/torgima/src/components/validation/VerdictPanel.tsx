import { LANGUAGE, getVerdictDisplay } from "@/lib/language";

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
  const verdictKey = (verdict ?? "adjust").toLowerCase();
  const display = getVerdictDisplay(verdictKey);
  const blocked = launchBlocked || verdictKey === "pivot";

  const msg =
    verdictKey === "proceed"
      ? "You can proceed. Your direction is validated."
      : verdictKey === "pivot"
        ? LANGUAGE.validation.pivotBlocked
        : "Adjustments recommended. Review the recommended path.";

  return (
    <div className="border-2 border-gray-200 rounded-2xl p-5 bg-white space-y-3 sticky top-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {LANGUAGE.validation.resultsSubtitle.split(".")[0]}
      </p>
      <span
        className="inline-block px-4 py-2 rounded-lg text-sm font-bold"
        style={{ color: display.color, backgroundColor: `${display.color}18` }}
      >
        {display.icon} {display.label}
      </span>
      <p className="text-sm text-gray-800 font-medium">{msg}</p>
      {reasoning && <p className="text-sm text-gray-600 leading-relaxed">{reasoning}</p>}
      {blocked && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-800">
          {LANGUAGE.validation.pivotBlocked}
        </div>
      )}
      {onLaunch && (
        <button
          type="button"
          disabled={blocked || launching}
          onClick={onLaunch}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {launching ? LANGUAGE.validation.launching : blocked ? LANGUAGE.validation.launchBlocked : LANGUAGE.validation.launchButton}
        </button>
      )}
    </div>
  );
}
