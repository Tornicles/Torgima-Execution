import { useCallback, useEffect, useState } from "react";
import {
  approveExpansionCapability,
  discoverExpansion,
  fetchExpansionHistory,
  fetchExpansionStatus,
  rollbackExpansionCapability,
} from "@/lib/bhudhi-expansion-api";

export function ExpansionSection({ blueprintId }: { blueprintId: string }) {
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [expansion, setExpansion] = useState<Record<string, unknown> | null>(null);
  const [capabilities, setCapabilities] = useState<
    Array<{
      capabilityId: string;
      capabilityKey: string;
      status: string;
      score: number;
      risk: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const st = await fetchExpansionStatus(blueprintId);
      setStatus(st.status);
      setCapabilities(st.status.capabilities ?? []);

      const discovered = await discoverExpansion(blueprintId);
      setExpansion(discovered.expansion);

      const hist = await fetchExpansionHistory(blueprintId);
      if (hist.capabilities.length > 0) {
        setCapabilities(hist.capabilities);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load expansion");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (capabilityId: string, approved: boolean) => {
    try {
      await approveExpansionCapability(blueprintId, capabilityId, approved, approved);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    }
  };

  const handleRollback = async (capabilityId: string) => {
    try {
      await rollbackExpansionCapability(blueprintId, capabilityId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed");
    }
  };

  if (loading && !status) {
    return <p className="text-sm text-gray-500">Loading expansion governance…</p>;
  }

  const rules = (status?.governanceRules as string[]) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">AGI Expansion Engine</h1>
          <p className="text-gray-600 text-sm max-w-xl">
            Bounded, governed self-improvement — Bhudhi proposes capabilities; humans approve.
            Not AGI: no auto self-modification, all changes reversible.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-sm underline text-gray-600"
        >
          {loading ? "Running…" : "Discover capabilities"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {status && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-3xl font-light">{String(status.activeCapabilities)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs text-gray-500">Proposed</p>
            <p className="text-3xl font-light">{String(status.proposedCapabilities)}</p>
          </div>
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-5">
            <p className="text-xs text-gray-500">Pending approval</p>
            <p className="text-3xl font-light">{String(status.pendingApprovals)}</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-5">
            <p className="text-xs text-gray-500">Can expand</p>
            <p className="text-lg font-medium">{status.canExpand ? "Yes" : "At limit"}</p>
          </div>
        </div>
      )}

      <div className="border border-red-200 bg-red-50 rounded-lg p-6">
        <h2 className="text-lg font-medium mb-3">Governance rules (non-bypassable)</h2>
        <ul className="text-sm space-y-1 text-gray-700">
          {rules.map((r) => (
            <li key={r}>✓ {r}</li>
          ))}
        </ul>
      </div>

      {expansion && (
        <div className="border border-gray-200 rounded-lg p-5 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-1">Latest discovery</p>
          <p>{String(expansion.recommendation ?? "")}</p>
          <p className="mt-2">
            Confidence {Math.round(((expansion.confidence as number) ?? 0) * 100)}% · Risk{" "}
            {Math.round(((expansion.risk as number) ?? 0) * 100)}%
          </p>
        </div>
      )}

      {capabilities.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Capability proposals</h2>
          <ul className="space-y-3">
            {capabilities.map((c) => (
              <li
                key={c.capabilityId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3"
              >
                <div>
                  <p className="font-medium">{c.capabilityKey}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {c.status} · score {Math.round(c.score * 100)}% · risk{" "}
                    {Math.round(c.risk * 100)}%
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.status === "candidate" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleApprove(c.capabilityId, true)}
                        className="text-xs px-3 py-1 bg-slate-800 text-white rounded"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleApprove(c.capabilityId, false)}
                        className="text-xs px-3 py-1 border border-gray-300 rounded"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {c.status === "promoted" && (
                    <button
                      type="button"
                      onClick={() => void handleRollback(c.capabilityId)}
                      className="text-xs px-3 py-1 border border-red-300 text-red-700 rounded"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
