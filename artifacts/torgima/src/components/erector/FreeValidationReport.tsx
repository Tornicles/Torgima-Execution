import { Link } from "wouter";
import { Download, RefreshCw, Sparkles } from "lucide-react";
import type { FreeErectorPath, FreeValidateResult } from "@/lib/erector-free-api";
import { ERECTOR_LABELS } from "@/lib/language-map";

type Props = {
  result: FreeValidateResult;
  onValidateAnother?: () => void;
  onDownloadJson?: () => void;
  downloading?: boolean;
};

const VERDICT_STYLES: Record<string, string> = {
  "Strong direction": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Needs adjustment": "bg-amber-100 text-amber-900 border-amber-200",
  "Consider a different angle": "bg-violet-100 text-violet-900 border-violet-200",
  "Test before building": "bg-sky-100 text-sky-900 border-sky-200",
  "High risk": "bg-red-100 text-red-800 border-red-200",
  "Not enough information": "bg-gray-100 text-gray-800 border-gray-200",
};

function PathCard({ path }: { path: FreeErectorPath }) {
  return (
    <article className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h4 className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">{path.path_name}</h4>
      <p className="mt-2 text-sm leading-6 text-gray-700">{path.what_it_means}</p>
      <p className="mt-3 text-xs font-semibold text-[#0A0F1E]">Likely outcome</p>
      <p className="mt-1 text-sm text-gray-600">{path.likely_outcome}</p>
      <p className="mt-3 text-xs font-semibold text-[#0A0F1E]">Main risk</p>
      <p className="mt-1 text-sm text-gray-600">{path.main_risk}</p>
    </article>
  );
}

function UpgradeCta({ upgradeUrl }: { upgradeUrl: string }) {
  return (
    <div className="rounded-2xl border border-[#0EA5E9]/30 bg-sky-50 p-5">
      <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">Upgrade to full TORGIMA</p>
      <p className="mt-2 text-sm leading-6 text-gray-700">
        Unlock the full Project Intelligence Intake to generate your complete Erector baseline, Blueprint,
        execution plan, order flow, signals, conditions, and progress loop.
      </p>
      <Link
        href={upgradeUrl}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0A0F1E] px-5 py-2.5 text-sm font-bold text-white"
      >
        <Sparkles className="h-4 w-4" />
        Unlock Full Blueprint
      </Link>
    </div>
  );
}

export function FreeValidationReport({ result, onValidateAnother, onDownloadJson, downloading }: Props) {
  const verdictStyle =
    VERDICT_STYLES[result.verdict_label] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const remaining = result.remaining_free_validations ?? result.remaining_free ?? 0;

  return (
    <div className="space-y-6 print:space-y-4" id="free-validation-report">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-[#0EA5E9]">
            {ERECTOR_LABELS.erector_free}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#0A0F1E]">{result.title}</h2>
          <p className="mt-1 text-sm text-gray-600">
            This is a fast reality check, not a full execution plan.
          </p>
          {remaining > 0 ? (
            <p className="mt-1 text-xs text-gray-500">
              {remaining} free validation{remaining === 1 ? "" : "s"} remaining in the next 24 hours
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {onDownloadJson ? (
            <button
              type="button"
              onClick={onDownloadJson}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0A0F1E] hover:bg-gray-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Downloading…" : "Download Report"}
            </button>
          ) : null}
          {onValidateAnother ? (
            <button
              type="button"
              onClick={onValidateAnother}
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#0A0F1E] hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Validate Another Idea
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${verdictStyle}`}>
            {result.verdict_label}
          </span>
          <span className="text-sm text-gray-600">{result.score_label}</span>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm font-semibold text-[#0A0F1E]">
            <span>Reality score</span>
            <span>{result.score}/100</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#0EA5E9] transition-all"
              style={{ width: `${Math.max(0, Math.min(100, result.score))}%` }}
            />
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-gray-700 whitespace-pre-wrap">{result.summary}</p>
      </div>

      <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <h3 className="text-lg font-bold text-[#0A0F1E]">Best direction</h3>
        <p className="mt-3 text-sm leading-7 text-gray-700">{result.recommended_direction}</p>
      </article>

      <div>
        <h3 className="mb-3 text-lg font-bold text-[#0A0F1E]">Three paths</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <PathCard path={result.current_path} />
          <PathCard path={result.adjusted_path} />
          <PathCard path={result.alternative_path} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-lg font-bold text-[#0A0F1E]">Top risks</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {result.top_risks.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-red-500">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-lg font-bold text-[#0A0F1E]">Opportunity areas</h3>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {result.top_opportunities.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-[#0EA5E9]">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-lg font-bold text-[#0A0F1E]">Market snapshot</h3>
          <p className="mt-3 text-sm leading-7 text-gray-700 whitespace-pre-wrap">{result.market_snapshot}</p>
        </article>
        <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-lg font-bold text-[#0A0F1E]">Execution snapshot</h3>
          <p className="mt-3 text-sm leading-7 text-gray-700 whitespace-pre-wrap">{result.execution_snapshot}</p>
        </article>
      </div>

      <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6">
        <h3 className="text-lg font-bold text-[#0A0F1E]">What to do next</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          {result.next_steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </article>

      <p className="text-sm text-gray-600">
        To unlock the full Erector baseline and Blueprint execution system, continue with Project
        Intelligence Intake.
      </p>

      <UpgradeCta upgradeUrl={result.upgrade_url} />
    </div>
  );
}
