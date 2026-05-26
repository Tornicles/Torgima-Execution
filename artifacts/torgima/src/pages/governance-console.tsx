import { useCallback, useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  fetchGovernanceAudit,
  fetchGovernanceHealth,
  type GovernanceHealth,
} from "@/lib/bhudhi-governance-api";

type GovView =
  | "overview"
  | "approvals"
  | "risk"
  | "policies"
  | "violations"
  | "audit"
  | "recovery";

const VIEWS: { id: GovView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "approvals", label: "Approval queue" },
  { id: "risk", label: "Risk center" },
  { id: "policies", label: "Policy center" },
  { id: "violations", label: "Violations" },
  { id: "audit", label: "Audit timeline" },
  { id: "recovery", label: "Recovery" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function GovernanceConsolePage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const storeBlueprintId = useBlueprintStore((s) => s.activeBlueprintId);
  const blueprintId = blueprintIdFromSearch(search) ?? storeBlueprintId ?? "";

  const [view, setView] = useState<GovView>("overview");
  const [health, setHealth] = useState<GovernanceHealth | null>(null);
  const [pending, setPending] = useState<Array<Record<string, unknown>>>([]);
  const [laws, setLaws] = useState<string[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const h = await fetchGovernanceHealth(blueprintId);
      setHealth(h.health);
      setPending(h.pendingApprovals as Array<Record<string, unknown>>);
      setLaws(h.immutableLaws);
      const a = await fetchGovernanceAudit(blueprintId);
      setAudit(a.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load governance");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!blueprintId) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Open governance console with an active blueprint (?blueprintId=).</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Bhudhi constitutional layer</p>
        <h1 className="text-3xl font-light text-gray-900">Governance console</h1>
        <p className="text-sm text-gray-600 mt-2">
          Governance approves. Bhudhi executes. Signals, conditions, and blueprint remain protected.
        </p>
      </header>

      <nav className="flex gap-2 flex-wrap border-b border-gray-200 mb-8 pb-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              view === v.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void reload()}
          className="ml-auto text-sm text-gray-500 hover:text-gray-800"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </nav>

      {error && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50 text-red-800 text-sm rounded-xl">{error}</div>
      )}

      {view === "overview" && health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Trust score</div>
            <div className="text-3xl font-light mt-2">{Math.round(health.trustScore * 100)}%</div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Pending approvals</div>
            <div className="text-3xl font-light mt-2">{health.pendingApprovals}</div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Violations</div>
            <div className="text-3xl font-light mt-2">{health.recentViolations}</div>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="text-xs text-gray-500 uppercase">Emergency</div>
            <div className="text-lg font-medium mt-2">{health.activeEmergency ?? "None"}</div>
          </div>
          <div className="sm:col-span-2 lg:col-span-4 border border-emerald-100 bg-emerald-50/50 rounded-xl p-5 text-sm text-emerald-900">
            Policies immutable: {health.policiesImmutable ? "Yes" : "No"} — Bhudhi cannot modify signals,
            conditions, or self-approve execution.
          </div>
        </div>
      )}

      {view === "approvals" && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <p className="text-gray-500 text-sm">No pending governance approvals.</p>
          ) : (
            pending.map((p) => (
              <div key={String(p.id)} className="border border-gray-200 rounded-xl p-4 flex justify-between">
                <div>
                  <div className="font-medium">{String(p.action)}</div>
                  <div className="text-xs text-gray-500">
                    Level {String(p.level)} · {String(p.subject_id)}
                  </div>
                </div>
                <span className="text-amber-600 text-sm">{String(p.status)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {view === "policies" && (
        <ul className="space-y-2 text-sm text-gray-700">
          {laws.map((law) => (
            <li key={law} className="border border-gray-100 rounded-lg px-4 py-3">
              {law}
            </li>
          ))}
        </ul>
      )}

      {view === "audit" && (
        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {audit.length === 0 ? (
            <p className="text-gray-500 text-sm">No audit events yet.</p>
          ) : (
            audit.map((e, i) => {
              const row = e as Record<string, unknown>;
              return (
                <div key={String(row.id ?? i)} className="border border-gray-100 rounded-lg p-3 text-sm">
                  <span className="font-medium">{String(row.event_type)}</span>
                  <span className="text-gray-500 ml-2">{String(row.decision)}</span>
                  <p className="text-xs text-gray-500 mt-1">{String(row.reasoning)}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {(view === "risk" || view === "violations" || view === "recovery") && (
        <p className="text-sm text-gray-600">
          {view === "risk" && "Risk assessments run on every governance check and before execution."}
          {view === "violations" && `${health?.recentViolations ?? 0} unresolved violations on record.`}
          {view === "recovery" &&
            "Use POST /api/bhudhi/governance/rollback or emergency endpoints for recovery control."}
        </p>
      )}
    </div>
  );
}
