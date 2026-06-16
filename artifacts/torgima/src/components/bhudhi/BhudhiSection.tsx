import { useState } from "react";
import { Link } from "wouter";
import { INTELLIGENCE_COPY } from "@/lib/language-map";
import type { IntelligenceStatusPayload } from "@/lib/intelligence-bridge";

interface IntelligenceQuickPanelProps {
  blueprintId: string;
  isOpen: boolean;
  onClose: () => void;
  status?: IntelligenceStatusPayload | null;
}

export function IntelligenceQuickPanel({ blueprintId, isOpen, onClose, status }: IntelligenceQuickPanelProps) {
  const [expanded, setExpanded] = useState<string | null>("systems");
  const [askQuery, setAskQuery] = useState("");

  if (!isOpen) return null;

  const engines = status?.engines?.bySystem;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-labelledby="intelligence-section-title"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 flex justify-between items-center z-10">
          <h2 id="intelligence-section-title" className="text-xl sm:text-2xl font-light">
            {INTELLIGENCE_COPY.name.toUpperCase()} Intelligence
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none p-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          <p className="text-xs text-gray-400 font-mono mb-2">{blueprintId.slice(0, 12)}…</p>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === "systems" ? null : "systems")}
              className="w-full p-4 font-medium text-left hover:bg-gray-50 text-sm sm:text-base"
            >
              5 core systems
            </button>
            {expanded === "systems" && (
              <div className="p-4 border-t border-gray-200 space-y-2 text-sm text-gray-700">
                {(status?.systems?.systems ?? [
                  { name: "investigation", engineCount: 13 },
                  { name: "intelligence", engineCount: 12 },
                  { name: "operating", engineCount: 10 },
                  { name: "security", engineCount: 5 },
                  { name: "preservation", engineCount: 7 },
                ]).map((s) => (
                  <div key={s.name} className="flex justify-between">
                    <span className="capitalize">{s.name}</span>
                    <span className="text-emerald-600">Active · {s.engineCount} engines</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === "engines" ? null : "engines")}
              className="w-full p-4 font-medium text-left hover:bg-gray-50 text-sm sm:text-base"
            >
              40+ engines running
            </button>
            {expanded === "engines" && (
              <div className="p-4 border-t border-gray-200 text-sm grid grid-cols-2 gap-2">
                <div>Investigation: {engines?.investigation ?? 13}</div>
                <div>Intelligence: {engines?.intelligence ?? 12}</div>
                <div>Operating: {engines?.operating ?? 10}</div>
                <div>Preservation: {engines?.preservation ?? 7}</div>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === "frameworks" ? null : "frameworks")}
              className="w-full p-4 font-medium text-left hover:bg-gray-50 text-sm sm:text-base"
            >
              14 frameworks + individual
            </button>
            {expanded === "frameworks" && (
              <div className="p-4 border-t border-gray-200 text-sm text-gray-600">
                <p>
                  {status?.frameworks?.team ?? 14} team · {status?.frameworks?.individual ?? 1}{" "}
                  individual
                </p>
                <p className="mt-2">Avg accuracy{" "}
                  {status?.frameworks?.avgAccuracy != null
                    ? `${Math.round(status.frameworks.avgAccuracy * 100)}%`
                    : "75%"}
                </p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4" data-voice-command="ask-intelligence-inline">
            <label htmlFor="intelligence-ask-inline" className="text-sm font-medium block mb-2">
              {INTELLIGENCE_COPY.askLabel}
            </label>
            <input
              id="intelligence-ask-inline"
              type="text"
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="Ask anything about your execution…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <Link
            href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`}
            className="block text-center text-sm text-[var(--torgima-primary)] font-medium py-3 hover:underline"
            onClick={onClose}
          >
            {INTELLIGENCE_COPY.openDashboard}
          </Link>
        </div>
      </div>
    </div>
  );
}
