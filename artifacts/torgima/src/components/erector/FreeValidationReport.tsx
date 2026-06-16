import { Link } from "wouter";
import { Download, Sparkles } from "lucide-react";
import {
  VERDICT_LABELS,
  type ErectorFreeReport,
  type ErectorFreeVerdict,
} from "@/lib/erector-free-api";
import { BLUEPRINT_LABELS, ERECTOR_LABELS } from "@/lib/language-map";

type Props = {
  report: ErectorFreeReport;
  remainingFree?: number;
};

const VERDICT_STYLES: Record<ErectorFreeVerdict, string> = {
  proceed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  adjust: "bg-amber-100 text-amber-900 border-amber-200",
  pivot: "bg-violet-100 text-violet-900 border-violet-200",
};

type Section = {
  title: string;
  body: string;
  bullets?: string[];
};

function buildSections(report: ErectorFreeReport): Section[] {
  return [
    { title: "Your Recommendation", body: report.section_recommendation },
    {
      title: BLUEPRINT_LABELS.signals,
      body: report.section_health_score_breakdown,
    },
    { title: "Market Reality", body: report.section_market_reality },
    { title: "Financial Assessment", body: report.section_financial_assessment },
    { title: "Execution Reality", body: report.section_execution_reality },
    {
      title: "Your Strengths",
      body: report.section_strengths,
      bullets: report.top_strengths,
    },
    {
      title: "Your Risk Flags",
      body: report.section_risk_flags,
      bullets: report.top_risks,
    },
    { title: "Your Best Direction", body: report.section_best_direction || report.primary_direction },
    {
      title: "Alternative Direction",
      body: report.section_alternative_direction || report.alternative_direction || "No alternative path identified yet.",
    },
    {
      title: "Your Success Conditions",
      body: report.section_success_conditions,
      bullets: report.success_conditions,
    },
    {
      title: "Your Failure Warnings",
      body: report.section_failure_warnings,
      bullets: report.failure_warnings,
    },
  ];
}

function UpgradeCta() {
  return (
    <div className="rounded-2xl border border-[#0EA5E9]/30 bg-sky-50 p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">
        Get the full deep analysis with {ERECTOR_LABELS.erector_pro}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Unlock deeper market research, competitive positioning, and a 90-day action map.
      </p>
      <Link
        href="/pricing"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0A0F1E] px-5 py-2.5 text-sm font-bold text-white"
      >
        <Sparkles className="h-4 w-4" />
        View Pro options
      </Link>
    </div>
  );
}

export function FreeValidationReport({ report, remainingFree }: Props) {
  const sections = buildSections(report);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6 print:space-y-4" id="free-validation-report">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">
            {ERECTOR_LABELS.validation_report}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#0A0F1E]">Your project analysis</h2>
          <p className="mt-1 text-sm text-gray-600">
            {remainingFree === undefined
              ? "Full deep assessment report"
              : remainingFree > 0
                ? `${remainingFree} free check${remainingFree === 1 ? "" : "s"} remaining`
                : "This was your last free check"}
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0A0F1E] hover:bg-gray-50"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${VERDICT_STYLES[report.verdict]}`}
          >
            {VERDICT_LABELS[report.verdict]}
          </span>
          <span className="text-sm text-gray-600">Overall recommendation</span>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm font-semibold text-[#0A0F1E]">
            <span>{BLUEPRINT_LABELS.signals}</span>
            <span>{report.validation_score}/100</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#0EA5E9] transition-all"
              style={{ width: `${Math.max(0, Math.min(100, report.validation_score))}%` }}
            />
          </div>
        </div>
      </div>

      {sections.map((section, index) => (
        <div key={section.title}>
          <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
            <h3 className="text-lg font-bold text-[#0A0F1E]">{section.title}</h3>
            <p className="mt-3 text-sm leading-7 text-gray-700 whitespace-pre-wrap">{section.body}</p>
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                {section.bullets.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-[#0EA5E9]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
          {(index + 1) % 3 === 0 && index < sections.length - 1 ? (
            <div className="mt-6 print:hidden">
              <UpgradeCta />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
