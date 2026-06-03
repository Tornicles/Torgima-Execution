import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import { LANGUAGE } from "@/lib/language";
import type { SignalPanelItem } from "@/types/signals-panel";
import { ExplainStateDrawer } from "./ExplainStateDrawer";

function DirectionIcon({ direction }: { direction: SignalPanelItem["direction"] }) {
  if (direction === "up") return <ArrowUp className="w-4 h-4 text-emerald-600" aria-hidden />;
  if (direction === "down") return <ArrowDown className="w-4 h-4 text-orange-600" aria-hidden />;
  return <ArrowRight className="w-4 h-4 text-gray-400" aria-hidden />;
}

export function SignalMetricsPanel({
  signals,
  tier,
  blueprintId,
}: {
  signals: SignalPanelItem[];
  tier: string;
  blueprintId: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [explainKey, setExplainKey] = useState<string | null>(null);
  const showRaw = tier === "ultimate";

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Execution signals</p>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {signals.map((sig) => {
            const isOpen = expanded === sig.key;
            return (
              <li key={sig.key} className="px-4 py-3">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : sig.key)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <DirectionIcon direction={sig.direction} />
                    <span className="text-sm font-medium text-gray-900 truncate">{sig.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-gray-600">{sig.status}</span>
                    {showRaw && sig.rawValue ? (
                      <span className="text-xs text-gray-400 font-mono">{sig.rawValue}</span>
                    ) : null}
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </span>
                </button>
                {isOpen ? (
                  <div className="mt-2 pl-6 pr-2 space-y-2">
                    <p className="text-xs text-gray-600 leading-relaxed">{sig.explanation}</p>
                    {blueprintId ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--torgima-primary)] hover:underline"
                        onClick={() => setExplainKey(sig.key)}
                      >
                        {LANGUAGE.signalsPanel.explain}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <ExplainStateDrawer
        open={Boolean(explainKey)}
        onClose={() => setExplainKey(null)}
        subject="signal"
        signalKey={explainKey ?? undefined}
        blueprintId={blueprintId}
      />
    </>
  );
}
