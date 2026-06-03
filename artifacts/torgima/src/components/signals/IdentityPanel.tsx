import { LANGUAGE } from "@/lib/language";
import type { IdentityPanelModel } from "@/types/signals-panel";

export function IdentityPanel({ identity }: { identity: IdentityPanelModel }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {LANGUAGE.signalsPanel.identityTitle}
      </p>
      <p className="text-lg font-bold text-gray-900">{identity.label}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{identity.description}</p>
      {identity.regressionNote ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {identity.regressionNote}
        </p>
      ) : null}
      <p className="text-xs text-gray-500">{identity.evidenceSummary}</p>
      <p className="text-sm text-gray-700">{identity.growthEdge}</p>
    </div>
  );
}
