import { useCallback, useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAppRouteGuard } from "@/hooks/useAppRouteGuard";
import { useBlueprintStore } from "@/store/blueprintStore";
import { fetchKernelContext, fetchKernelEvents, runBhudhiKernelCycle } from "@/lib/bhudhi-kernel-api";

function blueprintIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  return params.get("blueprintId");
}

export default function BhudhiKernelPage() {
  const { checking } = useAppRouteGuard("post-launch");
  const search = useSearch();
  const blueprintId = blueprintIdFromSearch(search) ?? useBlueprintStore((s) => s.activeBlueprintId) ?? "";

  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [chainId, setChainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!blueprintId) return;
    setLoading(true);
    setError(null);
    try {
      const cycle = await runBhudhiKernelCycle(blueprintId);
      setChainId(cycle.chainId);
      const ctx = await fetchKernelContext(blueprintId);
      setContext(ctx.context);
      const ev = await fetchKernelEvents(blueprintId, cycle.chainId);
      setEvents(ev.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kernel cycle failed");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    if (blueprintId) void fetchKernelContext(blueprintId).then((r) => setContext(r.context)).catch(() => {});
  }, [blueprintId]);

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
        <p className="text-xs uppercase tracking-widest text-gray-500">Unified Kernel</p>
        <h1 className="text-3xl font-light">Cognitive Kernel</h1>
        <p className="text-sm text-gray-600 mt-2 max-w-xl">
          One Bhudhi execution contract — Investigation → Intelligence → Security → Operating → Preservation
          via event bus and shared context.
        </p>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={() => void reload()} className="text-sm underline text-gray-600">
            {loading ? "Running cycle…" : "Run unified cycle"}
          </button>
          {blueprintId && (
            <Link href={`/bhudhi?blueprintId=${encodeURIComponent(blueprintId)}`} className="text-sm underline">
              Bhudhi
            </Link>
          )}
        </div>
      </header>

      {error && <p className="mb-4 text-sm text-red-600 border border-red-200 rounded-lg p-3">{error}</p>}

      {context && (
        <section className="mb-8 rounded-xl border border-gray-200 p-6 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Shared context</p>
          <p className="text-lg font-light">
            {String(context.domain)} · {String(context.phase)} · v{String(context.version)}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Signal: {String(context.signal)} · Last update: {String(context.lastUpdateEngine)}
          </p>
        </section>
      )}

      {chainId && (
        <section className="mb-6 rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Event chain</p>
          <p className="text-sm font-mono text-gray-700">{chainId}</p>
        </section>
      )}

      {events.length > 0 && (
        <section className="rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-light mb-3">Event bus ({events.length})</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            {events.map((e, i) => (
              <li key={i}>
                {String(e.eventType)} · {String(e.sourceEngine)} → {String(e.targetEngine)} ·{" "}
                {String(e.status)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
