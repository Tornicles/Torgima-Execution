import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { apiGet } from "@/lib/torgima-api";
import { DashboardPageLayout } from "@/components/shell/DashboardPageLayout";
import { MetricStatCard, MetricStatRow } from "@/components/design-system/MetricStatRow";
import { cards, buttons, PageLoading, PageEmpty } from "@/design";

type KnowledgeRow = { title: string; category: string; type: string; added: string };

const CATEGORY_COLORS: Record<string, string> = {
  learn: "text-emerald-600",
  sops: "text-blue-600",
  tools: "text-purple-600",
  benchmarks: "text-orange-600",
  failure: "text-red-600",
};

export function KnowledgeDashboardView() {
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiGet<{ tasks?: Array<{ title?: string; skill_category?: string; status?: string }> }>("/api/academy")
      .then((d) => {
        const items =
          d?.tasks?.map((t, i) => ({
            title: t.title ?? "Execution resource",
            category: (t.skill_category ?? "Learn").replace(/_/g, " "),
            type: "Guide",
            added: `May ${10 + i}, 2025`,
          })) ?? [];
        setRows(items);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));

  const categoryCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.category.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  if (loading) return <PageLoading />;

  return (
    <DashboardPageLayout
      title="Knowledge"
      subtitle="Learn, apply, and build execution intelligence."
      headerRight={
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge, examples, SOPs, tools…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </div>
      }
      stats={
        <MetricStatRow>
          <MetricStatCard label="Knowledge Items" value={String(rows.length)} sub="Total in library" valueClassName="text-emerald-600" />
          <MetricStatCard label="SOPs & Frameworks" value={String(categoryCounts.sops ?? categoryCounts.sop ?? 0)} sub="Step-by-step" valueClassName="text-blue-600" />
          <MetricStatCard label="Tools & Templates" value={String(categoryCounts.tools ?? 0)} sub="Reusable" valueClassName="text-purple-600" />
          <MetricStatCard label="Benchmarks" value={String(categoryCounts.benchmarks ?? 0)} sub="Standards" valueClassName="text-orange-600" />
          <MetricStatCard label="Active paths" value={String(Object.keys(categoryCounts).length)} sub="Categories" valueClassName="text-emerald-600" />
        </MetricStatRow>
      }
      rightRail={
        <div className={cards.padded}>
          <p className="text-xs font-bold uppercase text-gray-500 mb-3">Quick actions</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {["Add Note", "Upload", "Create SOP", "Saved"].map((a) => (
              <button key={a} type="button" className="border border-gray-200 rounded-lg py-2 hover:bg-gray-50">
                {a}
              </button>
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex justify-between items-center rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-sm text-emerald-900">Knowledge turns experience into leverage. Apply it daily.</p>
          <button type="button" className={buttons.primary}>
            Explore Knowledge Hub →
          </button>
        </div>
      }
    >
      <div>
        <p className="text-xs font-bold uppercase text-gray-500 mb-3">Knowledge categories</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(categoryCounts).map(([name, count]) => (
            <div key={name} className={cards.padded}>
              <p className={`font-bold capitalize ${CATEGORY_COLORS[name] ?? "text-gray-700"}`}>{name}</p>
              <p className="text-xs text-gray-500 mt-1">{count} items</p>
            </div>
          ))}
        </div>
      </div>

      <div className={cards.padded}>
        <p className="text-xs font-bold uppercase text-gray-500 mb-4">Recent knowledge</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2">Title</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8">
                    <PageEmpty
                      title="No knowledge items yet"
                      description="Complete academy orders to populate your library."
                    />
                  </td>
                </tr>
              ) : null}
              {filtered.map((r) => (
                <tr key={r.title} className="border-b border-gray-50">
                  <td className="py-3 font-medium">{r.title}</td>
                  <td className="py-3">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {r.category}
                    </span>
                  </td>
                  <td className="py-3 text-gray-500">{r.type}</td>
                  <td className="py-3 text-gray-500">{r.added}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardPageLayout>
  );
}
