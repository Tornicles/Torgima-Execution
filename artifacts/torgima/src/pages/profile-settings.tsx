import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProfileRow = {
  username: string;
  profile_url_slug: string;
  bio?: string;
  privacy_setting: string;
  profile_public: boolean;
  show_execution_level: boolean;
  show_avatar: boolean;
  show_achievements: boolean;
  show_principle_record: boolean;
  show_streak: boolean;
  show_activity: boolean;
};

type WidgetRow = { widget_type: string; embed_code: string };

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [widgets, setWidgets] = useState<WidgetRow[]>([]);
  const [pledgeText, setPledgeText] = useState("");
  const [pledgeDeadline, setPledgeDeadline] = useState("");
  const [socialPlatform, setSocialPlatform] = useState("linkedin");
  const [socialUrl, setSocialUrl] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet<{ profile: ProfileRow; widgets: WidgetRow[] }>(
      "/api/profiles/settings",
    ).catch(() => null);
    if (res?.profile) {
      setProfile(res.profile);
      setWidgets(res.widgets ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!profile) return;
    await apiPost("/api/profiles/settings", {
      bio: profile.bio,
      profilePrivacy: profile.privacy_setting,
      username: profile.username,
      showExecutionLevel: profile.show_execution_level,
      showAvatar: profile.show_avatar,
      showAchievements: profile.show_achievements,
      showPrincipleRecord: profile.show_principle_record,
      showStreak: profile.show_streak,
      showActivity: profile.show_activity,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await load();
  }

  async function addPledge() {
    if (!pledgeText || !pledgeDeadline) return;
    await apiPost("/api/profiles/pledges", {
      pledgeText,
      deadline: pledgeDeadline,
      isPublic: true,
    });
    setPledgeText("");
    setPledgeDeadline("");
  }

  async function addSocialLink() {
    if (!socialUrl) return;
    await apiPost("/api/profiles/social-links", { platform: socialPlatform, url: socialUrl });
    setSocialUrl("");
    await load();
  }

  const publicUrl =
    typeof window !== "undefined" && profile
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/profiles/${profile.profile_url_slug}`
      : "";

  return (
    <Layout pageTitle="Public profile" pageSubtitle="Privacy, sharing, widgets, and accountability pledges">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <Link href="/settings" className="text-sm text-green-700 hover:underline">
          ← Back to settings
        </Link>

        {!profile && <p className="text-sm text-gray-500">Loading profile settings…</p>}

        {profile && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile URL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-600 break-all">{publicUrl}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(publicUrl)}
                >
                  Copy link
                </Button>
                <Link
                  href={`/profiles/${profile.profile_url_slug}`}
                  className="block text-sm text-green-700 hover:underline"
                >
                  Preview public profile
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bio & privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Bio</Label>
                  <Textarea
                    value={profile.bio ?? ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Privacy</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={profile.privacy_setting}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        privacy_setting: e.target.value,
                        profile_public: e.target.value !== "private",
                      })
                    }
                  >
                    <option value="public">Public</option>
                    <option value="link-only">Link only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <VisibilityToggle
                  label="Show execution level"
                  checked={profile.show_execution_level}
                  onChange={(v) => setProfile({ ...profile, show_execution_level: v })}
                />
                <VisibilityToggle
                  label="Show streak"
                  checked={profile.show_streak}
                  onChange={(v) => setProfile({ ...profile, show_streak: v })}
                />
                <VisibilityToggle
                  label="Show achievements"
                  checked={profile.show_achievements}
                  onChange={(v) => setProfile({ ...profile, show_achievements: v })}
                />
                <VisibilityToggle
                  label="Show 365 principle record"
                  checked={profile.show_principle_record}
                  onChange={(v) => setProfile({ ...profile, show_principle_record: v })}
                />
                <Button onClick={() => void save()}>{saved ? "Saved" : "Save profile"}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Embeddable widgets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["streak-counter", "level-badge", "accountability-card"].map((type) => {
                  const w = widgets.find((x) => x.widget_type === type);
                  return (
                    <div key={type} className="text-sm">
                      <p className="font-medium capitalize">{type.replace(/-/g, " ")}</p>
                      {w?.embed_code ? (
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {w.embed_code}
                        </pre>
                      ) : (
                        <p className="text-gray-500 text-xs">Save profile to generate embed code.</p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Social links</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Platform"
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value)}
                  className="w-28"
                />
                <Input
                  placeholder="https://…"
                  value={socialUrl}
                  onChange={(e) => setSocialUrl(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={() => void addSocialLink()}>
                  Add
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accountability pledge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="What you commit to…"
                  value={pledgeText}
                  onChange={(e) => setPledgeText(e.target.value)}
                />
                <Input
                  type="date"
                  value={pledgeDeadline}
                  onChange={(e) => setPledgeDeadline(e.target.value)}
                />
                <Button size="sm" onClick={() => void addPledge()}>
                  Publish pledge
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

function VisibilityToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
