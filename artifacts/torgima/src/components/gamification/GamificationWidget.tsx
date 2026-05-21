import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiGet } from "@/lib/torgima-api";
import { Card, CardContent } from "@/components/ui/card";

type Profile = {
  currentLevel: number;
  totalXP: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  streaks: Array<{ streak_type: string; current_count: number }>;
};

const ICONS: Record<string, string> = {
  execution: "🔥",
  principles: "⚡",
  content: "✍️",
};

export function GamificationWidget() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void apiGet<{ profile: Profile }>("/api/gamification/profile")
      .then((d) => d?.profile && setProfile(d.profile))
      .catch(() => null);
  }, []);

  if (!profile) return null;

  const pct =
    profile.xpToNextLevel > 0
      ? Math.min(
          100,
          (profile.xpIntoLevel / (profile.xpIntoLevel + profile.xpToNextLevel)) * 100,
        )
      : 0;

  return (
    <Card className="border-violet-100 bg-gradient-to-br from-violet-50/80 to-white">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-800">Progress</p>
          <Link href="/progress" className="text-[10px] text-violet-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black text-lg">
            {profile.currentLevel}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Level {profile.currentLevel}</p>
            <p className="text-xs text-gray-500">{profile.totalXP.toLocaleString()} XP</p>
            <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(profile.streaks?.length
            ? profile.streaks
            : [
                { streak_type: "execution", current_count: 0 },
                { streak_type: "principles", current_count: 0 },
              ]
          )
            .slice(0, 3)
            .map((s) => (
              <span
                key={s.streak_type}
                className="text-[10px] bg-white border border-gray-100 rounded-md px-2 py-0.5"
                title={s.streak_type}
              >
                {ICONS[s.streak_type] ?? "📈"} {s.current_count}d
              </span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
