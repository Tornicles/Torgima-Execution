import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { adminSupportAction, fetchAdminUserDetail } from "@/admin/api/adminClient";

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const reload = () => {
    if (!userId) return;
    void fetchAdminUserDetail(userId).then(setDetail);
  };

  useEffect(() => {
    reload();
  }, [userId]);

  if (!detail) return <p className="text-slate-400">Loading user…</p>;

  const identity = detail.identity as Record<string, unknown>;
  const blueprint = detail.blueprint as Record<string, unknown> | null;

  async function run(action: "unlock" | "task" | "repair" | "message" | "note") {
    if (!userId) return;
    setStatus(null);
    try {
      if (action === "note") await adminSupportAction("note", userId, { note });
      else if (action === "message") await adminSupportAction("message", userId, { message });
      else await adminSupportAction(action, userId);
      setStatus(`${action} completed`);
      reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h2 className="text-xl font-bold text-white">{String(identity.email)}</h2>
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}

      <section className="rounded-xl border border-slate-800 p-4 space-y-2 text-sm text-slate-300">
        <h3 className="font-semibold text-white">Identity</h3>
        <p>ID: {String(identity.id)}</p>
        <p>Signed up: {String(identity.signedUpAt)}</p>
        <p>Last active: {String(identity.lastActiveAt ?? "—")}</p>
      </section>

      {blueprint ? (
        <section className="rounded-xl border border-slate-800 p-4 space-y-2 text-sm text-slate-300">
          <h3 className="font-semibold text-white">Blueprint</h3>
          <p className="text-slate-400 line-clamp-3">{String(blueprint.goal)}</p>
          <p>
            Tier {String(blueprint.tier)} · {String(blueprint.condition)} · v
            {String(blueprint.stateVersion)}
          </p>
          <p>Locked: {blueprint.systemLocked ? "yes" : "no"}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-semibold text-white mb-3">Support actions</h3>
        <div className="flex flex-wrap gap-2">
          {(["unlock", "task", "repair"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => void run(a)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-violet-600/30"
            >
              {a}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="System message to user…"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void run("message")}
            className="text-sm text-violet-400 hover:underline"
          >
            Send message
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal support note…"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void run("note")}
            className="text-sm text-violet-400 hover:underline"
          >
            Add note
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h3 className="font-semibold text-white mb-2">Recent events</h3>
        <ul className="text-xs text-slate-500 space-y-1 max-h-48 overflow-y-auto">
          {((detail.recentEvents as Array<Record<string, unknown>>) ?? []).map((e) => (
            <li key={String(e.id)}>
              {String(e.type)} — {String(e.at)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
