import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { apiGet } from "@/lib/torgima-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DayData = {
  entry: { principle_date: string; reflection?: string };
  principle?: { statement: string; philosophy?: string };
  application?: { application_description?: string; proof_url?: string };
  shareToken?: string;
};

export default function ProfileDayPage() {
  const [, params] = useRoute("/profiles/:username/entry/:entryDate");
  const username = params?.username ?? "";
  const entryDate = params?.entryDate ?? "";
  const [data, setData] = useState<DayData | null>(null);

  useEffect(() => {
    if (!username || !entryDate) return;
    void apiGet<DayData>(`/api/profiles/${username}/entries/${entryDate}`).then(setData);
  }, [username, entryDate]);

  const shareUrl =
    data?.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/principles/entry/${data.shareToken}`
      : null;

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href={`/profiles/${username}`} className="text-sm text-green-700 hover:underline">
          ← Back to profile
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{entryDate}</CardTitle>
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
            {shareUrl && (
              <a
                href={shareUrl}
                className="inline-flex text-sm font-medium text-green-700 hover:underline"
              >
                Open shareable link →
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
