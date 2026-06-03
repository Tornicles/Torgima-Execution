import { useEffect, useState } from "react";
import { Link } from "wouter";
import { fetchAdminUsers } from "@/admin/api/adminClient";

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAdminUsers>> | null>(null);

  useEffect(() => {
    void fetchAdminUsers({ page, search: search || undefined }).then(setData).catch(() => setData(null));
  }, [page, search]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Users</h2>
      <input
        type="search"
        placeholder="Search by email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white text-sm"
      />
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900 text-slate-500 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Blueprint</th>
              <th className="px-4 py-3">Tasks today</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(data?.users ?? []).map((u) => (
              <tr key={String(u.id)} className="text-slate-300 hover:bg-slate-900/50">
                <td className="px-4 py-3">{String(u.email)}</td>
                <td className="px-4 py-3">{String(u.tier ?? "—")}</td>
                <td className="px-4 py-3">{String(u.condition ?? "—")}</td>
                <td className="px-4 py-3">{String(u.blueprintStatus)}</td>
                <td className="px-4 py-3">{String(u.tasksToday)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${String(u.id)}`} className="text-violet-400 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="px-3 py-1 rounded border border-slate-700 text-sm text-slate-400 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1 rounded border border-slate-700 text-sm text-slate-400"
        >
          Next
        </button>
      </div>
    </div>
  );
}
