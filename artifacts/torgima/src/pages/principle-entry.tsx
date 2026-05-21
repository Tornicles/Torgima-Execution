import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { apiGet, apiPost } from "@/lib/torgima-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EntryData = {
  entry: { share_token: string; view_count: number; reaction_count: number; entry_date: string };
  profile?: { username: string; profile_url_slug: string };
  principle?: { statement: string; philosophy?: string };
  application?: { application_description?: string; proof_url?: string };
};

export default function PrincipleEntryPage() {
  const [, params] = useRoute("/principles/entry/:shareToken");
  const shareToken = params?.shareToken ?? "";
  const [data, setData] = useState<EntryData | null>(null);
  const [reacted, setReacted] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    void apiGet<EntryData>(`/api/profiles/entries/${shareToken}`).then(setData);
  }, [shareToken]);

  async function react() {
    await apiPost(`/api/profiles/entries/${shareToken}/react`, {});
    setReacted(true);
    if (data?.entry) {
      setData({
        ...data,
        entry: { ...data.entry, reaction_count: data.entry.reaction_count + 1 },
      });
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">Loading entry…</div>
    );
  }

  const slug = data.profile?.profile_url_slug ?? data.profile?.username;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {slug && (
          <Link href={`/profiles/${slug}`} className="text-sm text-green-700 hover:underline">
            ← Back to {data.profile?.username}
          </Link>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{data.entry.entry_date}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.principle && (
              <div>
                <h2 className="font-semibold text-gray-900">{data.principle.statement}</h2>
                {data.principle.philosophy && (
                  <p className="text-sm text-gray-600 mt-1">{data.principle.philosophy}</p>
                )}
              </div>
            )}
            {data.application?.application_description && (
              <p className="text-sm text-gray-700">{data.application.application_description}</p>
            )}
            {data.application?.proof_url && (
              <img src={data.application.proof_url} alt="Proof" className="rounded-lg max-h-64" />
            )}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button size="sm" variant="outline" onClick={() => void react()} disabled={reacted}>
                👍 {data.entry.reaction_count}
              </Button>
              <span className="text-xs text-gray-500">{data.entry.view_count} views</span>
              {typeof window !== "undefined" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard.writeText(window.location.href)
                  }
                >
                  Copy link
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
