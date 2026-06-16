import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { FreeValidationReport } from "@/components/erector/FreeValidationReport";
import { fetchPaidReport, type ErectorPaidReport } from "@/lib/erector-intake-api";
import { VERDICT_LABELS } from "@/lib/erector-free-api";

export default function OnboardingIntakeReportPage() {
  const [, params] = useRoute("/onboarding/intake/report/:validationId");
  const validationId = params?.validationId ?? "";
  const [report, setReport] = useState<ErectorPaidReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!validationId) return;
    let cancelled = false;
    void fetchPaidReport(validationId)
      .then((res) => {
        if (!cancelled) setReport(res.report);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Report not found.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [validationId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <p className="text-sm text-red-600">{error ?? "Report unavailable."}</p>
        <Link href="/onboarding/intake" className="mt-4 inline-block text-sm font-semibold text-[#16A34A]">
          Back to intake
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Erector Pro report</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0A0F1E]">
        {VERDICT_LABELS[report.verdict]} · {report.validation_score}/100
      </h1>
      <FreeValidationReport report={report} />
      <section className="mt-8 space-y-4 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-6">
        <h2 className="text-lg font-bold text-[#0A0F1E]">Strategy &amp; next steps</h2>
        <p className="text-sm text-[#334155]">{report.section_strategy_recommendation}</p>
        <p className="text-sm text-[#334155]">{report.section_competitive_position}</p>
        <p className="text-sm text-[#334155]">{report.section_90_day_action_map}</p>
      </section>
      <div className="mt-8">
        <Link href="/upgrade" className="rounded-xl bg-[#0A0F1E] px-5 py-3 text-sm font-semibold text-white">
          Upgrade to activate your blueprint
        </Link>
      </div>
    </div>
  );
}
