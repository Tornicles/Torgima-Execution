import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { createBhudhiOrganization, fetchOrganizationHistory } from "@/lib/bhudhi-organization-api";

type View = "overview" | "teams" | "authority" | "departments" | "culture" | "strategy" | "health";

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams" },
  { id: "authority", label: "Authority" },
  { id: "culture", label: "Culture" },
  { id: "strategy", label: "Strategy" },
  { id: "health", label: "Health" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiOrganizationPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("overview");
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<{ organizationId: string; name: string; healthScore: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBhudhiOrganization(blueprintId);
      setOrg(created.organization);
      const h = await fetchOrganizationHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const state = org?.organizationState as Record<string, unknown> | undefined;
  const health = org?.health as { score?: number; action?: string } | undefined;
  const alignment = org?.alignment as { score?: number; recommendations?: string[] } | undefined;
  const culture = org?.culture as { profile?: string; trust?: number } | undefined;

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-gray-500">BOOS</p>
        <h1 className="text-3xl font-light">Organization OS</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi helps organizations coordinate intelligently while humans remain accountable. Authority is explicit —
          never inferred.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Syncing…" : "Refresh"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-6">
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
      </nav>

      {error && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 text-red-800 text-sm rounded-xl">{error}</div>
      )}

      {view === "overview" && state && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <div className="text-lg font-medium">{String(state.name)}</div>
          <div>Nodes: {String(state.nodeCount)}</div>
          {health && <div>Health index: {health.score}/100</div>}
          {alignment && <div>Alignment: {Math.round((alignment.score ?? 0) * 100)}%</div>}
        </div>
      )}

      {view === "health" && health && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <div className="text-2xl font-light">{health.score}/100</div>
          {health.action && health.action !== "none" && (
            <div className="mt-2 text-amber-800">Action: {health.action}</div>
          )}
        </div>
      )}

      {view === "culture" && culture && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <div>Profile: {culture.profile}</div>
          {typeof culture.trust === "number" && (
            <div className="mt-1">Trust: {Math.round(culture.trust * 100)}%</div>
          )}
        </div>
      )}

      {view === "strategy" && alignment && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <ul className="list-disc pl-5 space-y-1">
            {(alignment.recommendations ?? []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {(view === "teams" || view === "authority") && (
        <p className="text-sm text-gray-600">
          {view === "teams"
            ? "Team sync detects misalignment, conflict, duplication, and bottlenecks."
            : "Authority levels: OWNER → EXECUTIVE → MANAGER → LEAD → MEMBER → OBSERVER."}
        </p>
      )}

      {history.length > 0 && view === "overview" && (
        <div className="mt-6 space-y-2">
          <div className="text-xs text-gray-500 uppercase">History</div>
          {history.map((h) => (
            <div key={h.organizationId} className="border border-gray-100 rounded-lg p-2 text-sm">
              {h.name} · health {h.healthScore}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
