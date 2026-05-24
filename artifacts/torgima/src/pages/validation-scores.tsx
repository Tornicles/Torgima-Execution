import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api-base";
import { apiGet } from "@/lib/torgima-api";
import { ValidationLayout } from "@/components/validation/ValidationLayout";
import { ErectorScoresDashboard } from "@/components/validation/ErectorScoresDashboard";

type ActiveDraft = {
  blueprintId: string;
  erectorValidationId?: string | null;
  validationId?: string | null;
};

function ValidationScoresContent() {
  const [, setLocation] = useLocation();
  const [scores, setScores] = useState<Record<string, number | string | undefined> | null>(null);
  const [realityScore, setRealityScore] = useState<number | undefined>();
  const [verdict, setVerdict] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiGet<ActiveDraft | null>("/api/v1/validation/active-draft")
      .then(async (draft) => {
        const validationId = draft?.erectorValidationId ?? draft?.validationId;
        if (!validationId) {
          setLocation("/onboarding/goal");
          return;
        }
        const res = await apiFetch(`/api/v1/validation/${validationId}/scores`);
        const json = (await res.json()) as {
          ok?: boolean;
          data?: {
            scores?: Record<string, number | string | undefined>;
            realityScore?: number;
            verdict?: string;
          };
        };
        if (json.ok && json.data?.scores) {
          setScores(json.data.scores);
          setRealityScore(json.data.realityScore);
          setVerdict(String(json.data.verdict ?? ""));
        }
      })
      .finally(() => setLoading(false));
  }, [setLocation]);

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">Loading scores…</p>;
  }

  if (!scores) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-gray-600">Validation scores are not ready yet.</p>
        <button
          type="button"
          className="text-sm font-semibold text-gray-900 underline"
          onClick={() => setLocation("/onboarding")}
        >
          Continue in onboarding →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-10 max-w-4xl mx-auto">
      <ErectorScoresDashboard
        scores={scores}
        realityScore={realityScore}
        verdict={verdict}
        recommendedBlueprintLevel={String(scores.recommendedBlueprintLevel ?? "")}
      />
    </div>
  );
}

export default function ValidationScoresPage() {
  return (
    <ValidationLayout>
      <ValidationScoresContent />
    </ValidationLayout>
  );
}
