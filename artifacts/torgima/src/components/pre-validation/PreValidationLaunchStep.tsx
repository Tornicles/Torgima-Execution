import { ChevronLeft, Rocket, Shield, Sparkles } from "lucide-react";
import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { GoalPurposeStepper } from "./GoalPurposeStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

export function PreValidationLaunchStep({
  draft,
  onBack,
  onLaunch,
  launching,
}: {
  draft: PreValidationDraft;
  onBack: () => void;
  onLaunch: () => void;
  launching?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-6xl px-6 pt-8 lg:px-10">
        <TorgimaPreLaunchLogo />
      </header>
      <div className="mx-auto max-w-4xl px-6 pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">READY TO REFINE &amp; VALIDATE</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          We will polish your goal and purpose, then run the full Erector validation.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-3xl px-4">
        <GoalPurposeStepper current={4} />
      </div>
      <main className="mx-auto max-w-3xl px-6 pb-44 pt-10 lg:px-10">
        <section className="rounded-[22px] border border-[#E2E8F0] bg-white p-8 shadow-sm space-y-4 text-sm">
          <p>
            <span className="font-semibold text-[#0B1220]">Goal:</span>{" "}
            <span className="text-[#475569]">{draft.goal}</span>
          </p>
          <p>
            <span className="font-semibold text-[#0B1220]">Purpose:</span>{" "}
            <span className="text-[#475569]">{draft.purpose}</span>
          </p>
          <p>
            <span className="font-semibold text-[#0B1220]">Country:</span>{" "}
            <span className="text-[#475569]">{draft.countryName}</span>
          </p>
          <p>
            <span className="font-semibold text-[#0B1220]">Timeframe:</span>{" "}
            <span className="text-[#475569]">{draft.timeframeDays} days</span>
          </p>
        </section>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Shield className="h-5 w-5 text-[#5B21FF]" />
          <button type="button" onClick={onBack} className="text-sm font-semibold text-[#64748B]">
            <ChevronLeft className="inline h-4 w-4" /> Back
          </button>
          <button
            type="button"
            disabled={launching}
            onClick={onLaunch}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#5B21FF] to-[#6D28D9] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200/60 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {launching ? "Starting…" : "Continue to Refinement"}
            <Rocket className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
