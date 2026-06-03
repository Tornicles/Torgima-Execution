import { useEffect, useState } from "react";
import { ErectorFlowShell } from "./ErectorFlowShell";
import {
  VALIDATION_PIPELINE_STAGES,
  validationPipelineLabel,
  validationStatusStep,
} from "@/lib/validation-run-status";

export const VALIDATION_RUNNING_STAGES = [
  "Receiving goal and purpose",
  "Reading country and economic context",
  "Checking market reality",
  "Reviewing demand and competition",
  "Detecting risks and opportunities",
  "Building current, adjusted, and alternative paths",
  "Preparing validation results",
] as const;

export type ValidationRunningContext = {
  goal: string;
  purpose: string;
  countryName: string;
  timeframeDays: number;
  commitmentLabel: string;
  domain: string;
  currentContext?: string;
};

export function ValidationRunningDashboard({
  context,
  error,
  onRetry,
  pipelineStatus,
}: {
  context: ValidationRunningContext;
  error?: string;
  onRetry?: () => void;
  /** When set, maps API validation_run status to progress (from polling). */
  pipelineStatus?: string;
}) {
  const statusStep = pipelineStatus ? validationStatusStep(pipelineStatus) : 0;
  const pipelineLabel = pipelineStatus ? validationPipelineLabel(pipelineStatus) : null;

  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    if (error || pipelineStatus) return;
    const stageTimer = window.setInterval(() => {
      setStageIndex((i) => (i + 1) % VALIDATION_RUNNING_STAGES.length);
    }, 1000);
    const progressTimer = window.setInterval(() => {
      setProgress((p) => (p >= 92 ? 92 : p + 4));
    }, 900);
    return () => {
      window.clearInterval(stageTimer);
      window.clearInterval(progressTimer);
    };
  }, [error, pipelineStatus]);

  useEffect(() => {
    if (!pipelineStatus || pipelineStatus === "failed") return;
    const step = Math.max(0, statusStep);
    setStageIndex(Math.min(step, VALIDATION_PIPELINE_STAGES.length - 1));
    const pct = pipelineStatus === "complete" ? 100 : Math.min(95, 8 + step * 10);
    setProgress(pct);
  }, [pipelineStatus, statusStep]);

  const stageText = pipelineLabel
    ? pipelineLabel
    : VALIDATION_RUNNING_STAGES[stageIndex];

  return (
    <ErectorFlowShell
      title="Validating your idea"
      subtitle="Bhudhi is validating your idea — checking reality, demand, risk, and execution path."
    >
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            <p className="text-sm font-medium text-violet-300">Bhudhi is validating your idea...</p>
          </div>
          <p className="text-xs text-slate-400">
            Checking reality, demand, risk, and execution path.
          </p>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500"
              style={{ width: `${error ? 0 : progress}%` }}
            />
          </div>
          <p className="text-sm text-slate-300">{stageText}…</p>
          {pipelineStatus ? (
            <p className="text-[10px] text-slate-500">
              Phase {Math.max(1, statusStep + 1)} of {VALIDATION_PIPELINE_STAGES.length}
            </p>
          ) : null}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <SummaryRow label="Goal" value={context.goal} />
          <SummaryRow label="Purpose" value={context.purpose} />
          <SummaryRow label="Country" value={context.countryName} />
          <SummaryRow label="Timeframe" value={`${context.timeframeDays} days`} />
          <SummaryRow label="Commitment" value={context.commitmentLabel} />
          <SummaryRow label="Domain" value={context.domain} />
        </div>
        {context.currentContext ? (
          <p className="text-xs text-slate-500">Context: {context.currentContext}</p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 space-y-3">
            <p className="text-sm text-red-300">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Retry validation
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ErectorFlowShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-800/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-200 mt-0.5 line-clamp-2">{value}</p>
    </div>
  );
}
