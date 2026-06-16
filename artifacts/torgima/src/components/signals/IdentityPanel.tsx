import { LANGUAGE } from "@/lib/language";
import type { IdentityPanelModel } from "@/types/signals-panel";

/** DOC 35 — identity stage panel; customer labels only. */
export function IdentityPanel({ identity }: { identity: IdentityPanelModel }) {
  const nextLabel = identity.nextStageLabel.startsWith("Next:")
    ? identity.nextStageLabel
    : LANGUAGE.signalsPanel.nextStage(identity.nextStageLabel);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {LANGUAGE.signalsPanel.identityTitle}
      </p>

      <div>
        <p className="text-lg font-bold text-gray-900">{identity.label}</p>
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">{identity.description}</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>{nextLabel}</span>
          <span>{identity.progressToNext}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--torgima-primary)] transition-all"
            style={{ width: `${identity.progressToNext}%` }}
            role="progressbar"
            aria-valuenow={identity.progressToNext}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      <p className="text-sm text-gray-800 leading-relaxed">{identity.transformationMessage}</p>

      {identity.regressionNote ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {identity.regressionNote}
        </p>
      ) : null}

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-gray-500">{LANGUAGE.signalsPanel.daysActiveMonth}</dt>
          <dd className="font-semibold text-gray-900">{identity.daysActiveThisMonth}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{LANGUAGE.signalsPanel.milestonesCompleted}</dt>
          <dd className="font-semibold text-gray-900">{identity.milestonesCompleted}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">{LANGUAGE.signalsPanel.currentStreak}</dt>
          <dd className="font-semibold text-gray-900">
            {LANGUAGE.signalsPanel.streakDays(identity.currentStreakDays)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
