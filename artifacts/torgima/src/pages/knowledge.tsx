import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";
import { AcademyOrderCard } from "@/components/execution/AcademyOrderCard";

type AcademyTask = {
  id: string;
  order_id: string;
  title?: string;
  description?: string;
  status?: string;
  skill_category?: string;
  lesson_number?: number;
  mastery_definition?: string;
};

type AcademyData = {
  tasks: AcademyTask[];
  activePaths: Array<{ skill_gap?: string; total_lessons?: number; completed_lessons?: number }>;
  skillProfile?: { skill_scores?: Record<string, number> };
};

export default function KnowledgePage() {
  const [data, setData] = useState<AcademyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/academy`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: AcademyData }) => {
        if (d.ok && d.data) setData(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const activePath = data?.activePaths?.[0];

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Capability development</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Academy</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Targeted execution skill paths when capability gaps block progress.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-gray-400 font-mono">Loading academy…</p>
      ) : (
        <>
          {activePath ? (
            <section className="rounded-xl border border-indigo-100 bg-white p-4 text-sm text-gray-700">
              <p className="font-semibold text-indigo-900">
                Active path: {(activePath.skill_gap ?? "skill").replace(/_/g, " ")}
              </p>
              <p className="text-xs font-mono mt-1 text-indigo-600">
                {activePath.completed_lessons ?? 0} of {activePath.total_lessons ?? "?"} execution steps complete
              </p>
            </section>
          ) : null}

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Open capability orders</h2>
            {(data?.tasks ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No active capability development orders.</p>
            ) : (
              (data?.tasks ?? []).map((task) => (
                <AcademyOrderCard
                  key={task.id}
                  order={{
                    id: task.order_id,
                    title: task.title,
                    instruction: task.description,
                    status: task.status,
                  }}
                  lessonNumber={task.lesson_number}
                  totalLessons={activePath?.total_lessons}
                  skillCategory={task.skill_category}
                  masteryDefinition={task.mastery_definition}
                />
              ))
            )}
          </section>

          <p className="text-xs text-gray-500">
            <Link href="/settings/skills" className="text-indigo-700 font-semibold hover:underline">
              View full skill profile
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
