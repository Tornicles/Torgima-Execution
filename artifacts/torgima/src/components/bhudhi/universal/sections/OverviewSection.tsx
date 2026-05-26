import { Link } from "wouter";
import { useBhudhiDashboard } from "@/hooks/useBhudhiDashboard";
import { formatConfidence, getSignalColor, getSignalLabel } from "@/lib/bhudhi-signals";
import { bhudhiPath } from "@/hooks/useBhudhiBlueprint";
import { fetchMemoryStats } from "@/lib/bhudhi-memory-api";
import { fetchProtocolHistory } from "@/lib/bhudhi-protocol-api";
import { useEffect, useState } from "react";

function StatCard({ label, value, subtext }: { label: string; value: number | string; subtext: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <div className="text-3xl font-light mb-2">{value}</div>
      <div className="text-sm text-gray-600">{subtext}</div>
    </div>
  );
}

function QuickLink({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="block border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition">
      <h3 className="font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </Link>
  );
}

export function OverviewSection({ blueprintId }: { blueprintId: string }) {
  const { status, signals, loading, error, reload } = useBhudhiDashboard(blueprintId);
  const [memoryNodes, setMemoryNodes] = useState<number | null>(null);
  const [protocolCount, setProtocolCount] = useState<number | null>(null);

  useEffect(() => {
    if (!blueprintId) return;
    void fetchMemoryStats(blueprintId)
      .then((s) => setMemoryNodes(s.stats.totalNodes))
      .catch(() => setMemoryNodes(null));
    void fetchProtocolHistory(blueprintId, 5)
      .then((h) => setProtocolCount(h.count))
      .catch(() => setProtocolCount(null));
  }, [blueprintId]);

  if (!blueprintId) {
    return (
      <p className="text-gray-500 text-sm">Select a blueprint from your dashboard to use Bhudhi.</p>
    );
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-2xl font-light text-gray-500">Loading…</p>
      </div>
    );
  }

  const globalSignal = signals?.signal ?? status?.signals?.global ?? null;
  const globalConfidence = signals?.confidence ?? status?.signals?.confidence ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Bhudhi Overview</h1>
          <p className="text-gray-600">Unified intelligence dashboard</p>
        </div>
        <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {globalSignal && (
        <div className={`border rounded-lg p-6 ${getSignalColor(globalSignal)}`}>
          <div className="text-sm uppercase tracking-wide mb-2 opacity-80">Global signal</div>
          <div className="text-3xl font-light mb-2">{getSignalLabel(globalSignal)}</div>
          {globalConfidence != null && (
            <div className="text-sm opacity-80">Confidence: {formatConfidence(globalConfidence)}</div>
          )}
          {signals?.interpretation && (
            <p className="text-sm mt-3 opacity-90">{signals.interpretation}</p>
          )}
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard
            label="Systems"
            value={status.systems?.total ?? 0}
            subtext={`${status.systems?.active ?? 0} active`}
          />
          <StatCard
            label="Engines"
            value={status.engines?.active ?? 0}
            subtext={`of ${status.engines?.total ?? 0} total`}
          />
          <StatCard
            label="Frameworks"
            value={status.frameworks?.total ?? 0}
            subtext={`Avg accuracy: ${((status.frameworks?.avgAccuracy ?? 0) * 100).toFixed(0)}%`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {memoryNodes != null && (
          <StatCard label="Memory nodes" value={memoryNodes} subtext="Unified memory graph" />
        )}
        {protocolCount != null && (
          <StatCard label="Protocol messages" value={protocolCount} subtext="Recent BHUDHI:// traffic" />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <QuickLink
          title="Execution"
          description="Kernel context, phase, and execution state"
          href={bhudhiPath("execution", blueprintId)}
        />
        <QuickLink
          title="Intelligence"
          description="Investigations and recommendations"
          href={bhudhiPath("intelligence", blueprintId)}
        />
        <QuickLink
          title="Governance"
          description="Signals, conditions, and controls"
          href={bhudhiPath("governance", blueprintId)}
        />
        <QuickLink
          title="Memory"
          description="Knowledge graph and timeline"
          href={bhudhiPath("memory", blueprintId)}
        />
      </div>
    </div>
  );
}
