import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";
import { ChevronLeft } from "lucide-react";

export default function SettingsSkillsPage() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [mastered, setMastered] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!API_BASE_URL) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE_URL}/api/academy/skills`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; data?: { skillScores?: Record<string, number>; masteredSkills?: string[] } }) => {
        if (d.ok && d.data) {
          setScores(d.data.skillScores ?? {});
          setMastered(d.data.masteredSkills ?? []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ChevronLeft className="w-4 h-4" />
        Settings
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Execution skills</h1>
        <p className="text-sm text-gray-500 mt-1">Capability scores from Academy and execution evidence.</p>
      </header>
      {loading ? (
        <p className="text-sm text-gray-400 font-mono">Loading skill profile…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Skill scores</h2>
            <div className="space-y-2">
              {Object.entries(scores).map(([skill, score]) => (
                <div
                  key={skill}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
                >
                  <span className="text-sm text-gray-800 capitalize">{skill.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full"
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-indigo-800 w-10 text-right">
                      {Math.round(score * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(scores).length === 0 ? (
                <p className="text-sm text-gray-500">
                  No skill profile yet. Complete capability development orders to build your profile.
                </p>
              ) : null}
            </div>
          </section>
          {mastered.length > 0 ? (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Mastered capabilities</h2>
              <ul className="flex flex-wrap gap-2">
                {mastered.map((s) => (
                  <li
                    key={s}
                    className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 capitalize"
                  >
                    {s.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
