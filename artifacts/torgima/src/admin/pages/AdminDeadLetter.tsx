import { useEffect, useState } from "react";
import { adminDlqAction, fetchAdminDeadLetter } from "@/admin/api/adminClient";

export default function AdminDeadLetterPage() {
  const [data, setData] = useState<{ events: Array<Record<string, unknown>> } | null>(null);

  const reload = () => void fetchAdminDeadLetter().then(setData);

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Dead letter queue</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {(data?.events ?? []).map((ev) => (
              <tr key={String(ev.id)}>
                <td className="px-4 py-3">{String(ev.eventType)}</td>
                <td className="px-4 py-3">{String(ev.userId ?? "—").slice(0, 8)}</td>
                <td className="px-4 py-3 max-w-xs truncate">{String(ev.failureReason)}</td>
                <td className="px-4 py-3 space-x-2">
                  {ev.replayAllowed ? (
                    <button
                      type="button"
                      className="text-violet-400 text-xs hover:underline"
                      onClick={() => void adminDlqAction("replay", String(ev.id)).then(reload)}
                    >
                      Replay
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-slate-500 text-xs hover:underline"
                    onClick={() => void adminDlqAction("dismiss", String(ev.id)).then(reload)}
                  >
                    Dismiss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
