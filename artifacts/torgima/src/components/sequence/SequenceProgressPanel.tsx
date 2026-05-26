import { Lock } from "lucide-react";
import type { FeatureStatusPayload } from "@/lib/feature-gate";
import { FEATURE_GATES, type FeatureKey } from "@/lib/feature-gate";

const HIGHLIGHT_FEATURES: FeatureKey[] = [
  "task_management",
  "feedback_system",
  "signal_tracking",
  "interrogation",
  "knowledge_cards",
  "adaptation",
  "predictions",
  "scene_analysis",
  "continuous_validation",
];

type Props = {
  status: FeatureStatusPayload | null;
  loading?: boolean;
};

export function SequenceProgressPanel({ status, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[var(--torgima-primary)] to-emerald-700 p-6 text-white animate-pulse">
        <p className="text-sm opacity-90">Loading execution progress…</p>
      </div>
    );
  }

  if (!status?.sequenceStatus) return null;

  const seq = status.sequenceStatus;
  const pct = Math.min(100, Math.round((seq.currentSequence / seq.totalSequences) * 100));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-[var(--torgima-primary)] to-emerald-700 p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Execution progress</p>
        <p className="text-3xl font-bold mt-2">
          Sequence {seq.currentSequence} of {seq.totalSequences}
        </p>
        <div className="w-full bg-white/30 rounded-full h-2 mt-4">
          <div
            className="bg-white h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm mt-2 opacity-90">
          {seq.completedCount} / {seq.totalSequences} sequences completed · {seq.tier} tier
        </p>
        {status.tierHint && <p className="text-xs mt-3 opacity-80">{status.tierHint}</p>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Available features</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {HIGHLIGHT_FEATURES.map((key) => {
              const gate = FEATURE_GATES[key];
              const feat = status.features[key];
              const available = feat?.available ?? false;
              return (
                <li key={key} className="flex items-start gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      available ? "bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                  <span className={available ? "text-gray-800" : "text-gray-400"}>
                    {gate.label}
                    {!available && feat?.reason && (
                      <span className="block text-xs text-gray-400 mt-0.5">{feat.reason}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Sequence map</h3>
          <div className="grid grid-cols-5 gap-1">
            {seq.sequences.map((s) => (
              <div
                key={s.number}
                title={s.locked ? `${s.name} (locked)` : s.name}
                className={`aspect-square rounded flex items-center justify-center text-[10px] font-semibold ${
                  s.completed
                    ? "bg-emerald-500 text-white"
                    : s.locked
                      ? "bg-gray-100 text-gray-400 opacity-60"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {s.locked ? <Lock className="w-3 h-3" /> : s.number}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
