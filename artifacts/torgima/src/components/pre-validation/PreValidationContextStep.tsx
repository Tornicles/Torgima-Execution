import { useState } from "react";
import { ChevronLeft, Save, Shield, Sparkles } from "lucide-react";
import { CountrySelector } from "@/components/onboarding/CountrySelector";
import type { CountrySelection } from "@/lib/countries";
import type { PreValidationDraft } from "@/lib/pre-validation-draft";
import { GoalPurposeStepper } from "./GoalPurposeStepper";
import { TorgimaPreLaunchLogo } from "./TorgimaPreLaunchLogo";

const DOMAIN_OPTIONS = [
  "SaaS",
  "Education",
  "Coaching",
  "Ecommerce",
  "Content",
  "Consulting",
  "Health & Fitness",
  "Finance",
  "Marketplace",
  "Local Business",
  "Other",
];

export function PreValidationContextStep({
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
  const [error, setError] = useState("");

  const country: CountrySelection | null = draft.countryName
    ? { countryName: draft.countryName, countryCode: draft.countryCode ?? "" }
    : null;

  function handleContinue() {
    if (!draft.countryName.trim()) {
      setError("Select your country to continue.");
      return;
    }
    const domain = draft.quickContext.domain || DOMAIN_OPTIONS[0];
    if (!draft.quickContext.domain) {
      onDraftChange({ quickContext: { ...draft.quickContext, domain } });
    }
    setError("");
    onContinue();
  }

  return (
    <div className="min-h-screen bg-white text-[#0B1220]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8 lg:px-10">
        <TorgimaPreLaunchLogo />
      </header>
      <div className="mx-auto max-w-4xl px-6 pt-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">DEFINE YOUR CONTEXT</h1>
        <p className="mt-2 text-sm text-[#64748B]">Where you operate and what domain you are building in.</p>
      </div>
      <div className="mx-auto mt-10 max-w-3xl px-4">
        <GoalPurposeStepper current={2} />
      </div>
      <main className="mx-auto max-w-3xl px-6 pb-44 pt-10 lg:px-10">
        <section className="space-y-6 rounded-[22px] border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <CountrySelector
            theme="light"
            value={country}
            onChange={(c) =>
              onDraftChange({
                countryName: c?.countryName ?? "",
                countryCode: c?.countryCode,
              })
            }
            error={error}
          />
          <label className="block text-sm font-semibold text-[#0B1220]">
            Industry / Domain
            <select
              value={draft.quickContext.domain}
              onChange={(e) =>
                onDraftChange({
                  quickContext: { ...draft.quickContext, domain: e.target.value },
                })
              }
              className="mt-2 w-full rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
            >
              <option value="">Select domain</option>
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-[#0B1220]">
            Additional context (optional)
            <textarea
              value={draft.currentContext}
              onChange={(e) => onDraftChange({ currentContext: e.target.value })}
              rows={4}
              placeholder="Anything else that helps us understand your situation."
              className="mt-2 w-full resize-none rounded-2xl border border-[#E2E8F0] bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#5B21FF] focus:ring-2 focus:ring-[#5B21FF]/15"
            />
          </label>
        </section>
      </main>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-[#5B21FF]" />
            <p className="text-xs text-[#64748B]">Your data is private and secure</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#64748B] hover:text-[#5B21FF]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={onSaveDraft}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-semibold"
          >
            <Save className="h-4 w-4 text-[#5B21FF]" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleContinue}
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
