import { useIntelligenceDashboard } from "@/lib/intelligence-bridge";
import { formatConfidence, getSignalColor, getSignalLabel } from "@/lib/bhudhi-signals";
import { Link } from "wouter";

export function GovernanceSection({ blueprintId }: { blueprintId: string }) {
  const { signals, loading, error, refreshSignals, reload } = useIntelligenceDashboard(blueprintId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Governance</h1>
          <p className="text-gray-600">Signals, conditions, and control</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => void refreshSignals()} className="underline text-gray-600">
            Recalculate signals
          </button>
          <button type="button" onClick={() => void reload()} className="underline text-gray-600">
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !signals && <p className="text-gray-500 text-sm">Loading…</p>}

      {signals?.signal && (
        <div className={`border rounded-lg p-6 ${getSignalColor(signals.signal)}`}>
          <h2 className="text-lg font-medium mb-4">Global signal</h2>
          <div className="text-3xl font-light mb-2">{getSignalLabel(signals.signal)}</div>
          {signals.confidence != null && (
            <div className="text-sm opacity-80 mb-2">
              Confidence: {formatConfidence(signals.confidence)}
            </div>
          )}
          {signals.interpretation && (
            <p className="text-sm opacity-90">{signals.interpretation}</p>
          )}
        </div>
      )}

      {signals?.frameworkSignals && Object.keys(signals.frameworkSignals).length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Framework signals</h2>
          <div className="space-y-2">
            {Object.entries(signals.frameworkSignals)
              .slice(0, 12)
              .map(([id, data]) => (
                <div key={id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium">{id}</span>
                    <span>{data.signal ?? "—"}</span>
                  </div>
                  {data.reasoning && (
                    <p className="text-xs text-gray-600 mt-1">{data.reasoning}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">
        <Link
          href={`/console/governance?blueprintId=${encodeURIComponent(blueprintId)}`}
          className="underline"
        >
          Open governance console
        </Link>{" "}
        for action rules and conditions.
      </p>
    </div>
  );
}
