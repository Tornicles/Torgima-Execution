import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Profile = {
  currentLevel: number;
  totalXP: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  totalAchievements: number;
  streaks: Array<{
    streak_type: string;
    current_count: number;
    best_count: number;
  }>;
  avatar?: { color: string; pose: string; accessories: string[] } | null;
};

type Achievement = {
  achievementId: string;
  title: string;
  description?: string;
  rarity: string;
  unlockedAt: string;
};

type Template = {
  id: string;
  avatar_name: string;
  evolution_level: number;
  customization_options: { colors?: string[]; poses?: string[] };
};

const STREAK_ICONS: Record<string, string> = {
  execution: "🔥",
  principles: "⚡",
  content: "✍️",
};

export default function GamificationPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stats, setStats] = useState<{ approximateRank?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [selectedColor, setSelectedColor] = useState("violet");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [ledger, setLedger] = useState<Array<{ xp_amount: number; xp_source: string; earned_at: string }>>([]);
  const [earnedRewards, setEarnedRewards] = useState<Array<{ title: string; rewardType: string }>>([]);
  const [availableRewards, setAvailableRewards] = useState<Array<{ title: string; reward_id: string }>>([]);
  const [tab, setTab] = useState<"overview" | "ledger" | "rewards">("overview");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, ach, tmpl, personal, led, earned, avail] = await Promise.all([
        apiGet<{ profile: Profile }>("/api/gamification/profile"),
        apiGet<{ achievements: Achievement[] }>("/api/gamification/achievements"),
        apiGet<{ templates: Template[] }>("/api/gamification/avatar/templates"),
        apiGet<{ stats: { approximateRank?: number } }>("/api/gamification/leaderboard/personal"),
        apiGet<{ ledger: Array<{ xp_amount: number; xp_source: string; earned_at: string }> }>(
          "/api/gamification/xp-ledger/me",
        ).catch(() => null),
        apiGet<{ rewards: Array<{ title: string; rewardType: string }> }>(
          "/api/gamification/rewards/earned",
        ).catch(() => null),
        apiGet<{ rewards: Array<{ title: string; reward_id: string }> }>(
          "/api/gamification/rewards/available",
        ).catch(() => null),
      ]);
      if (prof?.profile) {
        setProfile(prof.profile);
        setSelectedColor(prof.profile.avatar?.color ?? "violet");
      }
      if (ach?.achievements) setAchievements(ach.achievements);
      if (tmpl?.templates) {
        setTemplates(tmpl.templates);
        if (!selectedTemplate && tmpl.templates[0]) {
          setSelectedTemplate(tmpl.templates[0].id);
        }
      }
      if (personal?.stats) setStats(personal.stats);
      if (led?.ledger) setLedger(led.ledger);
      if (earned?.rewards) setEarnedRewards(earned.rewards);
      if (avail?.rewards) setAvailableRewards(avail.rewards);
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    void load();
  }, [load]);

  const progressPct =
    profile && profile.xpToNextLevel > 0
      ? Math.min(100, (profile.xpIntoLevel / (profile.xpIntoLevel + profile.xpToNextLevel)) * 100)
      : 0;

  async function saveAvatar() {
    if (!selectedTemplate) return;
    setCustomizing(true);
    try {
      await apiPost("/api/gamification/avatar/customize", {
        templateId: selectedTemplate,
        color: selectedColor,
        accessories: [],
        pose: "standing",
      });
      await load();
    } finally {
      setCustomizing(false);
    }
  }

  async function demoXp() {
    const r = await apiPost<{ xpAwarded?: number }>("/api/gamification/xp/award", {
      eventType: "order-completion",
      sourceId: "demo",
      eventData: { difficulty: 3 },
    });
    if (r?.xpAwarded) {
      setXpToast(r.xpAwarded);
      setTimeout(() => setXpToast(null), 1500);
    }
    await load();
  }

  if (loading && !profile) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">Loading progression…</div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {xpToast ? (
        <div className="fixed top-20 right-6 z-50 bg-violet-600 text-white px-4 py-2 rounded-xl shadow-lg animate-bounce">
          +{xpToast} XP
        </div>
      ) : null}

      <header>
        <p className="text-[10px] font-bold uppercase text-violet-800">Progress</p>
        <h1 className="text-2xl font-bold">Gamification</h1>
        <p className="text-sm text-gray-500">Real execution earns real XP — no participation trophies.</p>
        <div className="flex gap-2 mt-3">
          {(["overview", "ledger", "rewards"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1 rounded-full border ${
                tab === t ? "bg-violet-600 text-white border-violet-600" : "border-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {tab === "ledger" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">XP history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {ledger.length === 0 ? (
              <p className="text-gray-500">No XP events yet.</p>
            ) : (
              ledger.map((row, i) => (
                <div key={i} className="flex justify-between border-b pb-2">
                  <span className="text-violet-700 font-medium">+{row.xp_amount}</span>
                  <span className="text-gray-600">{row.xp_source}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(row.earned_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "rewards" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Earned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {earnedRewards.length === 0 ? (
                <p className="text-gray-500">Level up to earn cosmetics and badges.</p>
              ) : (
                earnedRewards.map((r, i) => (
                  <p key={i}>
                    {r.title} <span className="text-gray-400">({r.rewardType})</span>
                  </p>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {availableRewards.length === 0 ? (
                <p className="text-gray-500">All rewards unlocked.</p>
              ) : (
                availableRewards.map((r) => (
                  <p key={r.reward_id} className="text-gray-600">
                    {r.title}
                  </p>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab !== "overview" ? null : (
        <>

      <Card className="overflow-hidden">
        <CardContent className="p-6 flex gap-6 items-center">
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center text-white text-3xl font-black shadow-lg avatar-evolution">
            {profile?.currentLevel ?? 1}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Level {profile?.currentLevel ?? 1}</span>
              <span className="text-gray-500">
                {profile?.totalXP?.toLocaleString() ?? 0} XP total
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-600 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {profile?.xpIntoLevel ?? 0} / {(profile?.xpIntoLevel ?? 0) + (profile?.xpToNextLevel ?? 100)}{" "}
              XP to next level
            </p>
            {stats?.approximateRank ? (
              <p className="text-xs text-violet-700">Rank ~#{stats.approximateRank} by XP</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(profile?.streaks?.length ? profile.streaks : [
          { streak_type: "execution", current_count: 0, best_count: 0 },
          { streak_type: "principles", current_count: 0, best_count: 0 },
          { streak_type: "content", current_count: 0, best_count: 0 },
        ]).map((s) => (
          <Card key={s.streak_type}>
            <CardContent className="p-4 flex gap-3 items-center">
              <span className="text-2xl">{STREAK_ICONS[s.streak_type] ?? "📈"}</span>
              <div>
                <p className="text-xs uppercase text-gray-500">{s.streak_type}</p>
                <p className="font-bold">{s.current_count} days</p>
                <p className="text-xs text-gray-400">Best {s.best_count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Achievements</CardTitle>
          <span className="text-xs text-gray-500">{achievements.length} unlocked</span>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <p className="text-sm text-gray-500">Complete orders and principles to unlock badges.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map((a) => (
                <div
                  key={a.achievementId}
                  className={`border rounded-xl p-3 text-center achievement-unlock ${a.rarity}`}
                >
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-[10px] uppercase text-gray-400 mt-1">{a.rarity}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs border ${
                  selectedTemplate === t.id ? "border-violet-600 bg-violet-50" : "border-gray-200"
                }`}
              >
                {t.avatar_name} (L{t.evolution_level})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(templates.find((t) => t.id === selectedTemplate)?.customization_options?.colors ?? [
              "violet",
              "emerald",
              "sky",
            ]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedColor(c)}
                className={`w-8 h-8 rounded-full border-2 ${
                  selectedColor === c ? "border-gray-900 scale-110" : "border-transparent"
                }`}
                style={{
                  background:
                    c === "violet"
                      ? "#7c3aed"
                      : c === "emerald"
                        ? "#10b981"
                        : c === "sky"
                          ? "#0ea5e9"
                          : c === "amber"
                            ? "#f59e0b"
                            : "#6b7280",
                }}
                title={c}
              />
            ))}
          </div>
          <Button onClick={() => void saveAvatar()} disabled={customizing || !selectedTemplate}>
            Save avatar
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={() => void demoXp()}>
        Demo: award XP for test order completion
      </Button>
        </>
      )}

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
        .avatar-evolution { box-shadow: 0 0 24px rgba(124, 58, 237, 0.35); }
        .achievement-unlock.rare { border-color: #6366f1; }
        .achievement-unlock.epic { border-color: #a855f7; }
        .achievement-unlock.legendary { border-color: #f59e0b; }
      `}</style>
    </div>
  );
}
