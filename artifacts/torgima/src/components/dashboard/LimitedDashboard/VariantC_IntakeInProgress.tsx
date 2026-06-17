import { useState } from "react";
import { Link } from "wouter";
import { Lock, PlayCircle } from "lucide-react";
import { INTAKE_STEP_LABELS } from "@/lib/erector-intake-api";
import type { IntakeInProgressContext } from "./limited-dashboard-types";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "recently";
  const diffMin = Math.max(1, Math.round((Date.now() - then) / 60_000));
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const hours = Math.round(diffMin / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

export function VariantC_IntakeInProgress({
  context,
  userEmail,
}: {
  context: IntakeInProgressContext;
  userEmail: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const remainingMinutes = Math.max(2, Math.round((context.sections_total - context.sections_completed.length) * 1.5));

  const continueHref = `/onboarding/intake?session=${encodeURIComponent(context.session_id)}&section=${context.current_section}`;

  function handleSaveAndContinueLater() {
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-2xl rounded-[24px] border border-[#E8ECF0] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#5B21FF] px-6 py-8 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200">{userEmail}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
            {context.headline ?? "Complete your Project Intelligence Intake"}
          </h1>
          <p className="mt-3 text-sm text-violet-100 leading-relaxed whitespace-pre-line">
            {context.message ??
              "To build your execution system, validate your project reality, and unlock all Blueprint features, TORGIMA needs a few more details.\n\nYour dashboard is ready. Full execution unlocks after this intake is completed and your Erector baseline is generated."}
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4">
            <Lock className="w-5 h-5 text-[#94A3B8] shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-[#64748B] space-y-1">
              <p className="font-semibold text-[#475569]">Execution is locked</p>
              <p>Execution is locked until Project Intelligence Intake is complete.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <span>
                Section {context.sections_completed.length} of {context.sections_total} completed
              </span>
              <span>{context.percent_complete}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#5B21FF] transition-all"
                style={{ width: `${context.percent_complete}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[#64748B]">
              Saved {formatRelativeTime(context.last_saved)}
            </p>
          </div>

          <ul className="space-y-2">
            {INTAKE_STEP_LABELS.map((label, index) => {
              const section = index + 1;
              const done = context.sections_completed.includes(section);
              return (
                <li key={label} className="flex items-center gap-3 text-sm text-[#334155]">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-[#DCFCE7] text-[#166534]" : "border border-[#CBD5E1] text-[#94A3B8]"
                    }`}
                    aria-hidden
                  >
                    {done ? "✓" : section}
                  </span>
                  <span className={done ? "font-medium" : "text-[#64748B]"}>{label}</span>
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-[#64748B]">
            Your progress is saved. Pick up exactly where you left off. ~{remainingMinutes} minutes
            remaining.
          </p>

          <Link href={continueHref}>
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B21FF] px-5 py-3 text-sm font-bold text-white hover:bg-[#4C1D95] transition-colors cursor-pointer">
              <PlayCircle className="w-4 h-4" aria-hidden />
              {context.continue_cta ?? "Complete Intake"}
            </span>
          </Link>

          {!showConfirm ? (
            <button
              type="button"
              className="text-sm font-medium text-[#64748B] underline-offset-2 hover:underline"
              onClick={() => setShowConfirm(true)}
            >
              Save and continue later
            </button>
          ) : (
            <div className="rounded-xl border border-[#FECACA] bg-red-50 p-4 space-y-3">
              <p className="text-sm text-[#991B1B]">
                This will keep your saved progress. You can come back any time.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={() => handleSaveAndContinueLater()}
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
