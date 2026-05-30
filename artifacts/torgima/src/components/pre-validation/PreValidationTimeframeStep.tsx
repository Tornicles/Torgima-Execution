import { ChevronLeft, Save, Shield, Sparkles } from "lucide-react";
import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { GoalPurposeStepper } from "./GoalPurposeStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const TIMEFRAMES = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "180 days", days: 180 },
] as const;

const COMMITMENT = [
  { key: "LOW", label: "Low" },
  { key: "MEDIUM", label: "Medium" },
  { key: "HIGH", label: "High" },
  { key: "INTENSE", label: "Intense" },
] as const;

export function PreValidationTimeframeStep({
  draft,
  onDraftChange,
  onBack,
  onSaveDraft,
  onContinue,
}: {
  draft: PreValidationDraft;
  onDraftChange: (patch: Partial<PreValidationDraft>) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-6xl px-6 pt-8 lg:px-10">
        <TorgimaPreLaunchLogo />
      </header>
      <div className="mx-auto max-w-4xl px-6 pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">CHOOSE YOUR TIMEFRAME</h1>
        <p className="mt-2 text-sm text-[#64748B]">How long you want to pursue this direction.</p>
      </div>
      <div className="mx-auto mt-10 max-w-3xl px-4">
        <GoalPurposeStepper current={3} />
      </div>
      <main className="mx-auto max-w-3xl px-6 pb-44 pt-10 lg:px-10">
        <section className="space-y-6 rounded-[22px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-[#0B1220]">Execution timeframe</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.days}
                  type="button"
                  onClick={() => onDraftChange({ timeframeDays: t.days })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    draft.timeframeDays === t.days
                      ? "border-[#5B21FF] bg-[#F5F3FF] text-[#5B21FF]"
                      : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#C7D2FE]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0B1220]">Commitment level</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMITMENT.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onDraftChange({ commitment: c.key })}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    draft.commitment === c.key
                      ? "border-[#5B21FF] bg-[#5B21FF] text-white"
                      : "border-[#E2E8F0] text-[#64748B]"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Shield className="h-5 w-5 text-[#5B21FF]" />
          <button type="button" onClick={onBack} className="text-sm font-semibold text-[#64748B]">
            <ChevronLeft className="inline h-4 w-4" /> Back
          </button>
          <button type="button" onClick={onSaveDraft} className="inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold">
            <Save className="h-4 w-4 text-[#5B21FF]" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200/60"
          >
            <Sparkles className="h-4 w-4" />
            Continue to Next Step →
          </button>
        </div>
      </footer>
    </div>
  );
}
