import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { createBhudhiTeam, fetchTeamHealth, fetchTeamHistory } from "@/lib/bhudhi-teams-api";

type View = "overview" | "collaboration" | "consensus" | "execution" | "alignment" | "health";

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "collaboration", label: "Collaboration" },
  { id: "consensus", label: "Consensus" },
  { id: "execution", label: "Execution" },
  { id: "alignment", label: "Alignment" },
  { id: "health", label: "Health" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiTeamsPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("overview");
  const [team, setTeam] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<{ teamId: string; name: string; updatedAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBhudhiTeam(blueprintId);
      setTeam(created.team);
      const h = await fetchTeamHealth(blueprintId);
      setHealth(h.health);
      const hist = await fetchTeamHistory(blueprintId);
      setHistory(hist.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team intelligence");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const teamState = team?.teamState as Record<string, unknown> | undefined;
  const consensus = team?.consensus as Record<string, unknown> | undefined;
  const execution = team?.execution as Record<string, unknown> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BTIE</p>
        <h1 className="text-3xl font-light">Team Intelligence</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Collective intelligence — shared understanding, shared decisions, shared execution. Humans remain
          accountable; agents assist.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Refresh team"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {team && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Team graph</p>
          <p className="text-lg font-light">
            {String(teamState?.memberCount ?? 0)} members · Alignment{" "}
            {Math.round(Number(team?.alignment ?? 0) * 100)}%
          </p>
          <p className="text-sm text-gray-600 mt-2">{String(team?.recommendation ?? "")}</p>
        </section>
      )}

      <nav className="flex flex-wrap gap-2 mb-8">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              view === v.id ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === "consensus" && consensus && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Consensus radar</h2>
          <p className="text-sm">{String(consensus.decision)}</p>
          <p className="text-gray-500 text-sm mt-2">
            Agreement {Math.round(Number(consensus.agreement ?? 0) * 100)}% · Model {String(consensus.model)}
          </p>
        </section>
      )}

      {view === "execution" && execution && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Execution flow</h2>
          <p className="text-sm">
            Velocity {Math.round(Number(execution.velocity ?? 0) * 100)}% · Completion{" "}
            {Math.round(Number(execution.completion ?? 0) * 100)}%
          </p>
        </section>
      )}

      {view === "health" && health && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-2">Health matrix</h2>
          <p className="text-2xl font-light">{String(health.score)}/100</p>
          <p className="text-sm text-gray-600 mt-2">Action: {String(health.action)}</p>
        </section>
      )}

      {view === "overview" && teamState && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Humans {String(teamState.humanCount)} · Agents {String(teamState.agentCount)} · Owner{" "}
          {String(teamState.ownerId ?? "—")}
        </section>
      )}

      {history.length > 0 && (
        <section className="mt-10 rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Team history</h2>
          <ul className="space-y-2 text-sm text-gray-500">
            {history.map((h) => (
              <li key={h.teamId}>
                {h.name} — {h.updatedAt?.slice(0, 16)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
