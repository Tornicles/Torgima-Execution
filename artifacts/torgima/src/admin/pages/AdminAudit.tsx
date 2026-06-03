import { useEffect, useState } from "react";
import { fetchAdminAudit } from "@/admin/api/adminClient";

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    void fetchAdminAudit().then((d) => setEntries(d.entries));
  }, []);

  function exportCsv() {
    const rows = [["admin_email", "action_type", "target_user_id", "created_at"]];
    for (const e of entries) {
      rows.push([
        String(e.admin_email),
        String(e.action_type),
        String(e.target_user_id ?? ""),
        String(e.created_at),
      ]);
    }
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-audit.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Audit log</h2>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>
      <ul className="space-y-2 text-sm text-slate-400 max-h-[70vh] overflow-y-auto">
        {entries.map((e) => (
          <li key={String(e.id)} className="rounded-lg border border-slate-800 px-3 py-2">
            <span className="text-violet-300">{String(e.action_type)}</span> by {String(e.admin_email)}{" "}
            {e.target_user_id ? `→ ${String(e.target_user_id).slice(0, 8)}…` : ""} at{" "}
            {String(e.created_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}
