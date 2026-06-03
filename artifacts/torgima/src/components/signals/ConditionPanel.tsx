import { useState } from "react";
import { LANGUAGE } from "@/lib/language";
import type { ConditionPanelModel } from "@/types/signals-panel";
import { ExplainStateDrawer } from "./ExplainStateDrawer";

export function ConditionPanel({
  condition,
  blueprintId,
}: {
  condition: ConditionPanelModel;
  blueprintId: string | null;
}) {
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {LANGUAGE.condition.title}
            </p>
            <p className="text-2xl font-bold text-gray-900">{condition.label}</p>
            <p className="text-sm text-gray-600 mt-2">{condition.description}</p>
            {condition.transitionReason ? (
              <p className="text-xs text-gray-500 mt-2">Transition: {condition.transitionReason}</p>
            ) : null}
          </div>
          {blueprintId ? (
            <button
              type="button"
              onClick={() => setExplainOpen(true)}
              className="text-xs font-semibold text-[var(--torgima-primary)] hover:underline shrink-0"
            >
              {LANGUAGE.signalsPanel.explain}
            </button>
          ) : null}
        </div>

        <div className="text-sm text-gray-700 space-y-2">
          <p>
            <span className="font-semibold text-gray-900">{LANGUAGE.signalsPanel.conditionAvailable}:</span>{" "}
            {condition.allowedActions.join(", ")}
          </p>
          {condition.restrictedActions.length > 0 ? (
            <p>
              <span className="font-semibold text-gray-900">{LANGUAGE.signalsPanel.conditionLimited}:</span>{" "}
              {condition.restrictedActions.join(", ")}
            </p>
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
