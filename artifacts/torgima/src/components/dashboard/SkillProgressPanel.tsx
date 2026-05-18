import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API_BASE_URL } from "@/lib/api-base";

type SkillProfile = {
  skillScores?: Record<string, number>;
  masteredSkills?: string[];
};

type AcademyPayload = {
  activePaths?: Array<{ skill_gap?: string; completed_lessons?: number; total_lessons?: number }>;
  proofHistory?: unknown[];
  tasks?: Array<{ status?: string }>;
};

export function SkillProgressPanel() {
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [academy, setAcademy] = useState<AcademyPayload | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) return;
    Promise.all([
      fetch(`${API_BASE_URL}/api/academy/skills`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${API_BASE_URL}/api/academy`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([skillsRes, academyRes]) => {
        const skills = skillsRes as {
          ok?: boolean;
          data?: { skillScores?: Record<string, number>; masteredSkills?: string[] };
        };
        const ac = academyRes as { ok?: boolean; data?: AcademyPayload };
        if (skills.ok && skills.data) {
          setProfile({
            skillScores: skills.data.skillScores,
            masteredSkills: skills.data.masteredSkills,
          });
        }
        if (ac.ok && ac.data) setAcademy(ac.data);
        const completed =
          (ac.data?.proofHistory?.length ?? 0) > 0 ||
          (ac.data?.tasks?.some((t) => t.status === "completed") ?? false);
        setVisible(completed);
      })
      .catch(() => null);
  }, []);

  if (!visible || !profile) return null;

  const scores = profile.skillScores ?? {};
  const mastered = profile.masteredSkills ?? [];
  const paths = academy?.activePaths ?? [];

  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            Skill progression
          </p>
          <p className="text-sm text-gray-600 mt-0.5">Active capability development paths</p>
        </div>
        <Link href="/settings/skills" className="text-xs font-semibold text-indigo-700 hover:underline">
          View all skills
        </Link>
      </div>
      {paths.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {paths.map((p) => (
            <li key={p.skill_gap} className="flex justify-between text-gray-800">
              <span>{(p.skill_gap ?? "skill").replace(/_/g, " ")}</span>
              <span className="font-mono text-xs text-indigo-700">
                {p.completed_lessons ?? 0}/{p.total_lessons ?? "?"} steps
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(scores)
          .slice(0, 6)
          .map(([skill, score]) => (
            <div key={skill} className="rounded-lg bg-white border border-indigo-100 px-3 py-2">
              <p className="text-[10px] uppercase text-gray-500 truncate">{skill.replace(/_/g, " ")}</p>
              <p className="text-sm font-mono font-semibold text-indigo-900">{Math.round(score * 100)}%</p>
            </div>
          ))}
      </div>
      {mastered.length > 0 ? (
        <p className="text-xs text-gray-600">
          Mastered: {mastered.map((s) => s.replace(/_/g, " ")).join(", ")}
        </p>
      ) : null}
    </section>
  );
}
