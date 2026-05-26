import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { fetchIdentityDrift, fetchIdentityHistory, fetchIdentityProfile } from "@/lib/bhudhi-identity-api";

type View = "profile" | "values" | "growth" | "capabilities" | "motivation" | "drift" | "milestones";

const VIEWS: { id: View; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "values", label: "Values" },
  { id: "growth", label: "Growth" },
  { id: "capabilities", label: "Capabilities" },
  { id: "motivation", label: "Motivation" },
  { id: "drift", label: "Drift" },
  { id: "milestones", label: "Milestones" },
];

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiIdentityPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [view, setView] = useState<View>("profile");
  const [identity, setIdentity] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<
    Array<{ profileId: string; executionProfile: string; confidence: number }>
  >([]);
  const [drift, setDrift] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await fetchIdentityProfile(blueprintId);
      setIdentity(p.identity);
      const h = await fetchIdentityHistory(blueprintId);
      setHistory(h.history);
      const d = await fetchIdentityDrift(blueprintId);
      setDrift(d.drift);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load identity");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const state = identity?.identityState as Record<string, unknown> | undefined;
  const values = identity?.values as { rankedValues?: Array<{ key: string; protected: boolean }> } | undefined;
  const motivations = identity?.motivations as { motivationType?: string; stability?: number } | undefined;
  const capabilities = identity?.capabilities as { capabilityScore?: number; dimensions?: Record<string, unknown> } | undefined;
  const growth = identity?.growthDirection as { currentState?: string; nextIdentity?: string } | undefined;

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
        <p className="text-xs uppercase tracking-widest text-gray-500">BIIE</p>
        <h1 className="text-3xl font-light">Identity Intelligence</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Bhudhi helps users become the kind of person who completes goals — not just complete goals. Identity cannot
          override governance.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Refreshing…" : "Refresh"}
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

      {view === "profile" && state && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <div className="text-lg font-medium">{String(state.executionProfile)}</div>
          <div>Stage: {String(state.stage)}</div>
          <div>Maturity: {Math.round((Number(state.maturity) || 0) * 100)}%</div>
        </div>
      )}

      {view === "values" && values?.rankedValues && (
        <div className="space-y-2">
          {values.rankedValues.map((v) => (
            <div key={v.key} className="border border-gray-200 rounded-lg p-3 text-sm flex justify-between">
              <span>{v.key}</span>
              {v.protected && <span className="text-xs text-amber-700">protected</span>}
            </div>
          ))}
        </div>
      )}

      {view === "growth" && growth && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <div>Current: {growth.currentState}</div>
          <div className="mt-2">Next: {growth.nextIdentity}</div>
        </div>
      )}

      {view === "capabilities" && capabilities && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          Score: {Math.round((capabilities.capabilityScore ?? 0) * 100)}%
        </div>
      )}

      {view === "motivation" && motivations && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <div>Type: {motivations.motivationType}</div>
          <div className="mt-1">Stability: {Math.round((motivations.stability ?? 0) * 100)}%</div>
        </div>
      )}

      {view === "drift" && drift && (
        <div className="border border-gray-200 rounded-xl p-4 text-sm">
          <div>Detected: {String(drift.detected)}</div>
          {Array.isArray(drift.signals) && (
            <div className="mt-1">Signals: {(drift.signals as string[]).join(", ") || "none"}</div>
          )}
          <div className="mt-1">Action: {String(drift.action)}</div>
        </div>
      )}

      {view === "milestones" && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">No identity history yet.</p>
          ) : (
            history.map((h) => (
              <div key={h.profileId} className="border border-gray-200 rounded-lg p-3 text-sm">
                {h.executionProfile} · {Math.round(h.confidence * 100)}%
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
