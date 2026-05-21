import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { apiGet } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProfileData = {
  profile: {
    username: string;
    bio?: string;
    profile_url_slug: string;
    show_streak?: boolean;
    show_execution_level?: boolean;
    show_achievements?: boolean;
    show_principle_record?: boolean;
  };
  profileUrl?: string;
  streak?: { current_streak: number; best_streak: number };
  gamification?: { currentLevel: number; totalXP: number };
  achievements?: Array<{ title: string; rarity: string; description?: string }>;
  entries?: Array<{ principle_date: string; reflection?: string; id?: string }>;
  pledges?: Array<{ pledge_text: string; deadline: string; status: string }>;
  socialLinks?: Array<{ platform: string; url: string }>;
  shareMetrics?: { profileViews: number; entryViews: number; reactions: number };
};

export default function PublicProfilePage() {
  const [, params] = useRoute("/profiles/:username");
  const username = params?.username ?? "";
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/profiles/${username}`
      : "";

  useEffect(() => {
    if (!username) return;
    void apiGet<ProfileData>(`/api/profiles/${username}?ref=direct`)
      .then(setData)
      .catch(() => setError("Profile not found or private"));
  }, [username]);

  async function copyLink() {
    await navigator.clipboard.writeText(pageUrl);
    setShareOpen(false);
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      `Follow my Torgima execution journey — ${data?.profile.username ?? username}`,
    );
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${text}`, "_blank");
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">{error}</div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">Loading profile…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{data.profile.username}</h1>
              {data.profile.bio && <p className="mt-2 text-gray-600">{data.profile.bio}</p>}
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setShareOpen(!shareOpen)}>
                Share profile
              </Button>
              {shareOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10 p-2 space-y-1">
                  <button type="button" className="w-full text-left text-sm px-2 py-1 hover:bg-gray-50" onClick={() => void copyLink()}>
                    Copy link
                  </button>
                  <button type="button" className="w-full text-left text-sm px-2 py-1 hover:bg-gray-50" onClick={shareTwitter}>
                    Share on X
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4">
            {data.profile.show_streak && data.streak && (
              <Stat label="Streak" value={`${data.streak.current_streak} days`} />
            )}
            {data.profile.show_execution_level && data.gamification && (
              <Stat label="Level" value={String(data.gamification.currentLevel)} />
            )}
            {data.profile.show_achievements && data.achievements && (
              <Stat label="Achievements" value={String(data.achievements.length)} />
            )}
            {data.shareMetrics && (
              <Stat label="Profile views" value={String(data.shareMetrics.profileViews)} />
            )}
          </div>

          {(data.socialLinks ?? []).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {data.socialLinks!.map((l) => (
                <a
                  key={l.platform}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-green-700 hover:underline capitalize"
                >
                  {l.platform}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {(data.pledges ?? []).length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Accountability pledges</h2>
            <div className="space-y-2">
              {data.pledges!.map((p, i) => (
                <Card key={i}>
                  <CardContent className="pt-4 text-sm">
                    <p className="font-medium text-gray-900">{p.pledge_text}</p>
                    <p className="text-gray-500 mt-1">
                      Due {p.deadline} · {p.status}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.profile.show_achievements && (data.achievements ?? []).length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Achievements</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {data.achievements!.map((a, i) => (
                <div key={i} className="rounded-lg border bg-white p-3 text-sm">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{a.rarity}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.profile.show_principle_record && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">365-day principle record</h2>
            <div className="space-y-3">
              {(data.entries ?? []).map((entry) => (
                <Card key={entry.principle_date}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-gray-500">{entry.principle_date}</CardTitle>
                    <Link
                      href={`/profiles/${username}/entry/${entry.principle_date}`}
                      className="text-xs text-green-700 hover:underline"
                    >
                      View day
                    </Link>
                  </CardHeader>
                  {entry.reflection && (
                    <CardContent className="text-sm text-gray-700">{entry.reflection}</CardContent>
                  )}
                </Card>
              ))}
              {(data.entries ?? []).length === 0 && (
                <p className="text-sm text-gray-500">No public entries yet.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
