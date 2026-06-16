import { useState } from "react";
import { LANGUAGE } from "@/lib/language";
import { CONDITION_COLORS } from "@/lib/language-map";
import type { ConditionPanelModel } from "@/types/signals-panel";
import { ExplainStateDrawer } from "./ExplainStateDrawer";

const BADGE_CLASS: Record<string, string> = {
  grey: "bg-gray-100 text-gray-800 border-gray-200",
  red: "bg-red-50 text-red-800 border-red-200",
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  green: "bg-green-50 text-green-800 border-green-200",
  gold: "bg-yellow-50 text-yellow-900 border-yellow-200",
  purple: "bg-purple-50 text-purple-800 border-purple-200",
};

/** DOC 35 — expanded condition panel for signals page (read-only). */
export function ConditionPanel({
  condition,
  blueprintId,
}: {
  condition: ConditionPanelModel;
  blueprintId: string | null;
}) {
  const [explainOpen, setExplainOpen] = useState(false);
  const colorKey = CONDITION_COLORS[condition.conditionKey] ?? "blue";
  const badgeClass = BADGE_CLASS[colorKey] ?? BADGE_CLASS.blue;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${badgeClass}`}
            >
              {condition.label}
            </span>
            {condition.durationDays > 0 ? (
              <p className="text-sm text-gray-600">{condition.durationLabel}</p>
            ) : null}
            <p className="text-sm text-gray-700 leading-relaxed">{condition.description}</p>
          </div>
          {blueprintId ? (
            <button
              type="button"
              onClick={() => setExplainOpen(true)}
              className="text-sm font-semibold text-[var(--torgima-primary)] hover:underline shrink-0"
            >
              {LANGUAGE.signalsPanel.explain}
            </button>
          ) : null}
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-900">{LANGUAGE.signalsPanel.conditionAvailable}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {condition.allowedActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {condition.restrictedActions.length > 0 ? (
            <div>
              <p className="font-semibold text-gray-900">{LANGUAGE.signalsPanel.conditionLimited}</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {condition.restrictedActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>
            <span className="font-semibold text-gray-900">{LANGUAGE.signalsPanel.conditionUnlock}:</span>{" "}
            {condition.nextUnlock}
          </p>
        </div>
      </div>

      <ExplainStateDrawer
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        subject="condition"
        blueprintId={blueprintId}
      />
    </>
  );
}
