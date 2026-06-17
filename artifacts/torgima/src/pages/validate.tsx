import { useCallback, useEffect, useState } from "react";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { FreeIntakeForm, type FreeIntakeValues } from "@/components/erector/FreeIntakeForm";
import { FreeValidationReport } from "@/components/erector/FreeValidationReport";
import { UpgradeWall } from "@/components/erector/UpgradeWall";
import { useMarketingMetadata } from "@/lib/marketing-metadata";
import {
  FreeValidationLimitError,
  downloadFreeReportJson,
  getOrCreateAnonymousSessionId,
  getOrCreateFingerprint,
  submitFreeValidation,
  type FreeValidateResult,
} from "@/lib/erector-free-api";

type ViewState = "form" | "loading" | "report" | "upgrade";

const LOADING_STEPS = [
  "Reviewing your idea",
  "Checking market and budget fit",
  "Mapping execution reality",
  "Preparing your report",
];

export default function ValidatePage() {
  useMarketingMetadata({
    title: "Free Project Intelligence Check",
    path: "/validate",
  });

  const [view, setView] = useState<ViewState>("form");
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeValidateResult | null>(null);
  const [validationId, setValidationId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (view !== "loading") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const pct = Math.min(95, Math.round((elapsed / 8000) * 100));
      setProgress(pct);
      setLoadingStep(Math.min(LOADING_STEPS.length - 1, Math.floor(elapsed / 2000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [view]);

  const handleSubmit = useCallback(async (values: FreeIntakeValues) => {
    setError(null);
    setView("loading");
    setProgress(8);
    setLoadingStep(0);

    const fingerprint = getOrCreateFingerprint();
    const anonymous_session_id = getOrCreateAnonymousSessionId();
    const minDelay = new Promise((resolve) => window.setTimeout(resolve, 1200));

    try {
      const [validationResult] = await Promise.all([
        submitFreeValidation({ ...values, fingerprint, anonymous_session_id }),
        minDelay,
      ]);
      applyResult(validationResult);
      setProgress(100);
      if ((validationResult.remaining_free_validations ?? 0) > 0) {
        setView("report");
      }
    } catch (err) {
      if (err instanceof FreeValidationLimitError) {
        setView("upgrade");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setView("form");
    }
  }, []);

  function applyResult(validationResult: FreeValidateResult) {
    setResult(validationResult);
    if (validationResult.validation_id) setValidationId(validationResult.validation_id);
    if ((validationResult.remaining_free_validations ?? 0) <= 0) {
      setView("upgrade");
    }
  }

  function handleValidateAnother() {
    setResult(null);
    setValidationId(null);
    setView("form");
  }

  async function handleDownloadJson() {
    if (!validationId) return;
    setDownloading(true);
    try {
      const payload = await downloadFreeReportJson(validationId, getOrCreateFingerprint());
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `torgima-free-validation-${validationId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <MarketingLayout>
      <section className="px-5 py-12 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#0EA5E9]">Project Intelligence</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#0A0F1E]">Free Idea Check</h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            Answer a few quick questions and get a lightweight reality check — no account required.
          </p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-8">
            {view === "form" ? <FreeIntakeForm onSubmit={handleSubmit} /> : null}

            {view === "loading" ? (
              <div className="rounded-3xl border border-[#E5E7EB] bg-white p-8 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-[#0EA5E9] border-t-transparent" />
                <p className="mt-5 text-lg font-semibold text-[#0A0F1E]">Running your free validation…</p>
                <p className="mt-2 text-sm text-gray-600">{LOADING_STEPS[loadingStep]}</p>
                <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#0EA5E9] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}

            {view === "report" && result ? (
              <FreeValidationReport
                result={result}
                onValidateAnother={handleValidateAnother}
                onDownloadJson={handleDownloadJson}
                downloading={downloading}
              />
            ) : null}

            {view === "upgrade" ? (
              <div className="space-y-8">
                {result ? (
                  <FreeValidationReport
                    result={result}
                    onDownloadJson={handleDownloadJson}
                    downloading={downloading}
                  />
                ) : null}
                <UpgradeWall validationId={validationId} />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
