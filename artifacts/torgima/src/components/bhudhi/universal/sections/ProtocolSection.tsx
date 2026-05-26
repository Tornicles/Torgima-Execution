import { useCallback, useEffect, useState } from "react";
import {
  fetchProtocolHistory,
  fetchProtocolRoutes,
  sendProtocolMessage,
} from "@/lib/bhudhi-protocol-api";

export function ProtocolSection({ blueprintId }: { blueprintId: string }) {
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [routes, setRoutes] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchProtocolRoutes();
      setRoutes(r.routes);
      if (blueprintId) {
        const h = await fetchProtocolHistory(blueprintId);
        setMessages(h.messages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load protocol");
    } finally {
      setLoading(false);
    }
  }, [blueprintId]);

  useEffect(() => {
    void reload();
  }, [reload]);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-4xl font-light mb-2">Protocol</h1>
          <p className="text-gray-600">BHUDHI:// messages and routes</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => void reload()} className="underline text-gray-600">
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" onClick={() => void sendSample()} className="underline text-gray-600">
            Send sample
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="text-lg font-medium mb-3">Registered routes</h2>
        <ul className="space-y-1 text-sm font-mono text-gray-700">
          {routes.length === 0 && <li className="text-gray-500">No routes loaded.</li>}
          {routes.map((r) => (
            <li key={String(r.id ?? r.pattern)}>
              {String(r.pattern)} → {String(r.handler)}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-medium mb-3">Recent messages</h2>
        <ul className="space-y-3">
          {messages.length === 0 && (
            <li className="text-sm text-gray-500">No protocol messages yet.</li>
          )}
          {messages.map((msg) => (
            <li key={String(msg.id)} className="border border-gray-200 rounded-lg p-4 text-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-xs">{String(msg.uri)}</span>
                <span className="text-xs text-gray-500">{String(msg.status)}</span>
              </div>
              <p className="text-xs text-gray-600">
                {String(msg.from ?? msg.from_engine)} → {String(msg.to ?? msg.to_engine)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
