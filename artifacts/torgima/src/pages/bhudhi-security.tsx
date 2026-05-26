import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  verifyBhudhiSecurity,
  fetchSecurityHistory,
  fetchSecurityThreats,
} from "@/lib/bhudhi-security-api";

type View = "trust" | "threats" | "authorization" | "capabilities" | "incidents" | "secrets";

const VIEWS: { id: View; label: string }[] = [
  { id: "trust", label: "Trust" },
  { id: "threats", label: "Threats" },
  { id: "authorization", label: "Authorization" },
  { id: "capabilities", label: "Capabilities" },
  { id: "incidents", label: "Incidents" },
  { id: "secrets", label: "Secrets" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiSecurityPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("trust");
  const [security, setSecurity] = useState<Record<string, unknown> | null>(null);
  const [threats, setThreats] = useState<Array<{ threat: string; severity: string }>>([]);
  const [history, setHistory] = useState<
    Array<{ id: string; trustScore: number; decision: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const verified = await verifyBhudhiSecurity(blueprintId);
      setSecurity(verified.security);
      const t = await fetchSecurityThreats(blueprintId);
      setThreats(t.threats);
      const h = await fetchSecurityHistory(blueprintId);
      setHistory(h.history);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load security");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const authorization = security?.authorization as Record<string, unknown> | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BSE</p>
        <h1 className="text-3xl font-light">Security</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi is secure because trust is continuously verified — identity, authorization, capabilities,
          audit.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Verify trust"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {security && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Trust map</p>
          <p className="text-lg font-light">
            {String(security.trustLevel ?? "LIMITED")} — {Math.round(Number(security.trustScore ?? 0) * 100)}% trust
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Decision {String(security.decision)} · Risk {Math.round(Number(security.risk ?? 0) * 100)}%
          </p>
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

      {view === "trust" && security && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Permission graph</h2>
          <p className="text-sm text-gray-600">
            Permissions: {(security.permissions as string[] | undefined)?.join(", ") ?? "none"}
          </p>
        </section>
      )}

      {view === "threats" && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Threat radar</h2>
          <ul className="space-y-2 text-sm">
            {threats.map((t, i) => (
              <li key={i} className="flex justify-between border-b border-gray-100 pb-2">
                <span>{t.threat}</span>
                <span className="text-gray-500">{t.severity}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "authorization" && authorization && (
        <section className="rounded-xl border p-6 text-sm">
          <p>Allowed: {String(authorization.allowed)}</p>
          <p className="text-gray-600 mt-2">
            Constraints: {(authorization.constraints as string[] | undefined)?.join(", ") ?? "none"}
          </p>
        </section>
      )}

      {view === "capabilities" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Every action declares capability, level, scope, expiration. No hidden capabilities.
        </section>
      )}

      {view === "incidents" && history.length > 0 && (
        <section className="rounded-xl border p-6">
          <h2 className="text-lg font-light mb-4">Security timeline</h2>
          <ul className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="text-gray-500">
                {h.createdAt?.slice(0, 16)} — {h.decision} (trust {Math.round(h.trustScore * 100)}%)
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "secrets" && (
        <section className="rounded-xl border p-6 text-sm text-gray-600">
          Secrets stored as vault references only — rotation, expiration, revocation supported.
        </section>
      )}
    </div>
  );
}
