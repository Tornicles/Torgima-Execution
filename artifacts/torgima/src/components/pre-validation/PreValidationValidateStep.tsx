import { ChevronLeft, Rocket, Shield, Sparkles, Zap } from "lucide-react";
import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { PreValidationStepper } from "./PreValidationStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

export function PreValidationValidateStep({
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
      <header className="mx-auto flex max-w-[1536px] flex-wrap items-start justify-between gap-4 px-6 pt-6 lg:px-10">
        <TorgimaPreLaunchLogo />
        <div className="hidden flex-1 justify-center lg:flex">
          <PreValidationStepper current={4} />
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] px-4 py-3 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Zap className="h-4 w-4 text-[#5B21FF]" />
            FAST SETUP MODE
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 lg:hidden">
        <PreValidationStepper current={4} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pt-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B21FF]">Step 4 of 4</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Validate Your Idea</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          We will polish your goal and purpose, then run the full Erector reality validation.
        </p>
      </div>

      <main className="mx-auto max-w-2xl px-6 pb-44 pt-10">
        <section className="rounded-[22px] border border-[#E2E8F0] bg-[#F5F3FF]/40 p-8 text-center shadow-sm">
          <Rocket className="mx-auto h-10 w-10 text-[#5B21FF]" />
          <p className="mt-4 text-sm text-[#475569]">
            Your inputs for <strong className="text-[#0B1220]">{draft.quickContext.domain || "your domain"}</strong> in{" "}
            <strong className="text-[#0B1220]">{draft.countryName}</strong> are ready.
          </p>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
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
            {launching ? "Starting…" : "Start Validation"}
            <Rocket className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
