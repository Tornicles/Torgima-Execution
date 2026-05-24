import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiFetchEnvelope } from "@/lib/torgima-api";
import { ValidationLayout } from "@/components/validation/ValidationLayout";
import {
  ErectorScoresDashboard,
  type ErectorValidationReport,
} from "@/components/validation/ErectorScoresDashboard";

type ActiveDraft = {
  blueprintId: string;
  erectorValidationId?: string | null;
  validationId?: string | null;
};

function ValidationScoresContent() {
  const [, setLocation] = useLocation();
  const [report, setReport] = useState<ErectorValidationReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const draftEnvelope = await apiFetchEnvelope<ActiveDraft | null>("/api/v1/validation/active-draft");
      const validationId =
        draftEnvelope.data?.erectorValidationId ?? draftEnvelope.data?.validationId;
      if (!validationId) {
        setLocation("/onboarding");
        return;
      }
      const detailEnvelope = await apiFetchEnvelope<ErectorValidationReport>(
        `/api/v1/validation/${validationId}`,
      );
      console.log("[ERECTOR_DASHBOARD_LOAD]", {
        ok: detailEnvelope.ok,
        validationId,
        data: detailEnvelope.data,
      });
      if (detailEnvelope.ok && detailEnvelope.data) {
        setReport({
          ...detailEnvelope.data,
          validationId,
          blueprintId: detailEnvelope.data.blueprintId ?? draftEnvelope.data?.blueprintId,
        });
      }
    })().finally(() => setLoading(false));
  }, [setLocation]);

  if (loading) {
    return <p className="p-8 text-sm text-gray-500">Loading validation report…</p>;
  }

  if (!report?.scores) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-sm text-gray-600">Validation report is not ready yet.</p>
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
    <div className="min-h-screen bg-gray-100 p-4 lg:p-8 max-w-6xl mx-auto">
      <ErectorScoresDashboard
        report={report}
        onLaunch={() => setLocation("/onboarding")}
        onDownload={() => window.print()}
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
