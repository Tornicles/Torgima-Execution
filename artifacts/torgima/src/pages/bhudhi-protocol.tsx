import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import {
  fetchProtocolHistory,
  fetchProtocolRoutes,
  sendProtocolMessage,
} from "@/lib/bhudhi-protocol-api";

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiProtocolPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchProtocolRoutes();
      setRoutes(r.routes);
      const h = await fetchProtocolHistory(blueprintId);
      setHistory(h.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load protocol layer");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    if (blueprintId) void reload();
  }, [blueprintId, reload]);

  async function sendSample() {
    if (!blueprintId) return;
    setLoading(true);
    try {
      await sendProtocolMessage(
        blueprintId,
        "investigation",
        "intelligence",
        "bhudhi://investigation/complete",
        { blueprintId, sample: true },
        true,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

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
        <p className="text-xs uppercase tracking-widest text-gray-500">Protocol Layer</p>
        <h1 className="text-3xl font-light">BHUDHI://</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          Internal communication language for engine-to-engine messages — URIs, routes, contracts, and
          message history.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" onClick={() => void sendSample()} className="text-sm underline text-gray-600">
            Send sample message
          </button>
          {blueprintId && (
            <>
              <Link
                href={`/bhudhi/kernel?blueprintId=${encodeURIComponent(blueprintId)}`}
                className="text-sm underline"
              >
                Kernel
              </Link>
              <Link
                href={`/bhudhi/memory?blueprintId=${encodeURIComponent(blueprintId)}`}
                className="text-sm underline"
              >
                Memory
              </Link>
            </>
          )}
        </div>
      </header>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Registered routes</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {routes.length === 0 && <li>No routes loaded yet.</li>}
          {routes.map((r) => (
            <li key={String(r.id ?? r.pattern)} className="font-mono text-xs">
              {String(r.pattern)} → {String(r.handler)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Message history</h2>
        <ul className="space-y-3">
          {history.length === 0 && <li className="text-sm text-gray-500">No protocol messages yet.</li>}
          {history.map((m) => (
            <li key={String(m.id)} className="border border-gray-200 rounded-lg p-3 text-sm">
              <p className="font-mono text-xs text-gray-600">{String(m.uri)}</p>
              <p>
                {String(m.from_engine ?? m.from)} → {String(m.to_engine ?? m.to)} · {String(m.status)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
